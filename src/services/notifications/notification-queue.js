/**
 * Notification Queue Manager
 * Manages notification delivery using Bull queue and Redis
 */

const Queue = require('bull');
const redis = require('redis');
const pool = require('../../db/pool');
const NotificationService = require('./notification-service');

class NotificationQueue {
  constructor(config = {}) {
    this.config = config;
    this.queue = null;
    this.notificationService = null;
    this.isInitialized = false;
    
    // Redis configuration
    this.redisUrl = config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
  }

  async initialize(notificationService) {
    try {
      console.log('[NotificationQueue] Initializing...');

      this.notificationService = notificationService;

      // Create Bull queue
      this.queue = new Queue('notifications', this.redisUrl);

      // Process jobs
      this.queue.process(this.config.concurrency || 10, async (job) => {
        return await this.processNotification(job);
      });

      // Event handlers
      this.queue.on('completed', (job) => {
        console.log(`[Queue] Job ${job.id} completed`);
      });

      this.queue.on('failed', (job, error) => {
        console.error(`[Queue] Job ${job.id} failed:`, error.message);
      });

      this.queue.on('error', (error) => {
        console.error('[Queue] Error:', error.message);
      });

      this.isInitialized = true;
      console.log('[NotificationQueue] ✓ Initialized');
      return true;
    } catch (error) {
      console.error('[NotificationQueue] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Add notification to queue
   */
  async enqueue(notification, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('NotificationQueue not initialized');
      }

      const jobOptions = {
        priority: this.getPriority(notification.priority),
        attempts: options.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: false,
        removeOnFail: false
      };

      // Add delay if scheduled
      if (notification.scheduled_for) {
        jobOptions.delay = new Date(notification.scheduled_for).getTime() - Date.now();
      }

      const job = await this.queue.add(notification, jobOptions);

      // Store queue reference in database
      await pool.query(`
        INSERT INTO notification_queue (notification_id, queue_id, status, priority)
        VALUES ($1, $2, 'pending', $3)
      `, [notification.id, job.id, jobOptions.priority]);

      console.log(`[Queue] Notification ${notification.notification_id} queued (Job: ${job.id})`);

      return job;
    } catch (error) {
      console.error('[NotificationQueue] Enqueue failed:', error.message);
      throw error;
    }
  }

  /**
   * Process individual notification
   */
  async processNotification(job) {
    try {
      const notification = job.data;

      console.log(`[Queue] Processing notification ${notification.notification_id}`);

      // Update status to processing
      await pool.query(`
        UPDATE notification_queue SET status = 'processing', process_started_at = CURRENT_TIMESTAMP
        WHERE queue_id = $1
      `, [job.id]);

      // Send notification
      const result = await this.notificationService.send(notification);

      // Update notification status
      await pool.query(`
        UPDATE notifications SET status = 'sent', sent_at = CURRENT_TIMESTAMP
        WHERE notification_id = $1
      `, [notification.notification_id]);

      // Update queue
      await pool.query(`
        UPDATE notification_queue SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE queue_id = $1
      `, [job.id]);

      console.log(`[Queue] Notification ${notification.notification_id} sent successfully`);

      return {
        success: true,
        notificationId: notification.notification_id,
        jobId: job.id
      };
    } catch (error) {
      console.error(`[Queue] Processing failed:`, error.message);

      // Update as failed
      const notification = job.data;
      try {
        await pool.query(`
          UPDATE notifications SET status = 'failed', failed_at = CURRENT_TIMESTAMP
          WHERE notification_id = $1
        `, [notification.notification_id]);

        await pool.query(`
          UPDATE notification_queue SET status = 'failed', last_error = $1
          WHERE queue_id = $2
        `, [error.message, job.id]);
      } catch (updateError) {
        console.error('Failed to update notification status:', updateError.message);
      }

      throw error;
    }
  }

  /**
   * Retry failed notifications
   */
  async retryFailed(maxAge = 3600000) {
    try {
      const query = `
        SELECT n.*, nq.queue_id, nq.attempts
        FROM notifications n
        JOIN notification_queue nq ON n.id = nq.notification_id
        WHERE nq.status = 'failed' 
        AND nq.attempts < nq.max_attempts
        AND n.created_at > NOW() - INTERVAL '${maxAge} milliseconds'
      `;

      const result = await pool.query(query);
      let retryCount = 0;

      for (const notification of result.rows) {
        try {
          await this.enqueue(notification, {
            maxRetries: notification.max_attempts - notification.attempts
          });
          retryCount++;
        } catch (error) {
          console.error(`Failed to retry notification ${notification.notification_id}:`, error.message);
        }
      }

      console.log(`[Queue] Retried ${retryCount} failed notifications`);
      return retryCount;
    } catch (error) {
      console.error('[Queue] Retry failed notifications error:', error.message);
      throw error;
    }
  }

  /**
   * Process queued offline notifications when user comes online
   */
  async processOfflineQueue(userId) {
    try {
      const query = `
        SELECT * FROM notifications
        WHERE user_id = $1 AND status = 'pending'
        ORDER BY priority DESC, created_at ASC
      `;

      const result = await pool.query(query, [userId]);

      for (const notification of result.rows) {
        try {
          await this.enqueue(notification);
        } catch (error) {
          console.error(`Failed to queue offline notification:`, error.message);
        }
      }

      return result.rows.length;
    } catch (error) {
      console.error('[Queue] Process offline queue error:', error.message);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    try {
      const counts = await this.queue.getJobCounts();

      const dbStats = await pool.query(`
        SELECT status, COUNT(*) as count FROM notification_queue GROUP BY status
      `);

      const stats = {
        queued: counts.waiting,
        processing: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed,
        database: {}
      };

      dbStats.rows.forEach(row => {
        stats.database[row.status] = row.count;
      });

      return stats;
    } catch (error) {
      console.error('[Queue] Get stats error:', error.message);
      throw error;
    }
  }

  /**
   * Clear completed jobs
   */
  async clearCompleted(days = 7) {
    try {
      const timestamp = Date.now() - (days * 24 * 60 * 60 * 1000);

      await this.queue.clean(timestamp, 'completed');
      await this.queue.clean(timestamp, 'failed');

      console.log(`[Queue] Cleaned jobs older than ${days} days`);
      return true;
    } catch (error) {
      console.error('[Queue] Clear completed error:', error.message);
      throw error;
    }
  }

  /**
   * Pause queue
   */
  async pause() {
    try {
      await this.queue.pause();
      console.log('[Queue] Paused');
      return true;
    } catch (error) {
      console.error('[Queue] Pause error:', error.message);
      throw error;
    }
  }

  /**
   * Resume queue
   */
  async resume() {
    try {
      await this.queue.resume();
      console.log('[Queue] Resumed');
      return true;
    } catch (error) {
      console.error('[Queue] Resume error:', error.message);
      throw error;
    }
  }

  /**
   * Map priority to queue priority number
   */
  getPriority(priority) {
    const priorityMap = {
      critical: 0,
      urgent: 1,
      normal: 2,
      low: 3
    };
    return priorityMap[priority] || 2;
  }

  /**
   * Close queue
   */
  async close() {
    try {
      if (this.queue) {
        await this.queue.close();
        console.log('[NotificationQueue] Closed');
      }
    } catch (error) {
      console.error('[NotificationQueue] Close error:', error.message);
    }
  }
}

module.exports = NotificationQueue;