/**
 * Routing Analytics
 * 
 * Tracks and analyzes:
 * - Hospital utilization reports
 * - Average response time by hospital
 * - Load distribution fairness
 * - Route efficiency metrics
 * - Deviation from recommendations (paramedic overrides)
 * - Patient outcomes by routing decision
 */

class RoutingAnalytics {
  constructor(pool, redis, logger = console) {
    this.pool = pool;
    this.redis = redis;
    this.logger = logger;
    this.sessionMetrics = new Map();
    this.analyticsBuffer = [];
    this.bufferFlushInterval = 60000; // 1 minute
    
    // Start periodic flush
    this.startBufferFlush();
  }

  startBufferFlush() {
    setInterval(() => this._flushBuffer(), this.bufferFlushInterval);
  }

  recordRoutingDecision(routeId, decision) {
    const metric = {
      timestamp: new Date().toISOString(),
      routeId,
      recommendedHospital: decision.primary.hospital.id,
      recommendedScore: decision.primary.score,
      patientCondition: decision.patientCondition,
      patientSeverity: decision.patientSeverity,
      paramedicsDeviatedFromRecommendation: false
    };

    this.sessionMetrics.set(routeId, metric);
    this.analyticsBuffer.push(metric);

    this.logger.log(`[Analytics] Routing decision recorded: ${routeId}`);
  }

  recordParamedicsOverride(routeId, actualHospital, reason) {
    const metric = this.sessionMetrics.get(routeId);
    
    if (metric) {
      metric.paramedicsDeviatedFromRecommendation = true;
      metric.actualHospital = actualHospital;
      metric.overrideReason = reason;
      metric.overrideTime = new Date().toISOString();
    }

    this.logger.log(`[Analytics] Override recorded for ${routeId}: ${reason}`);
  }

  recordPatientOutcome(routeId, outcome) {
    const metric = this.sessionMetrics.get(routeId);
    
    if (metric) {
      metric.patientOutcome = outcome.status; // 'critical', 'stable', 'discharged', 'transferred'
      metric.hospitalAdmitted = outcome.hospital;
      metric.admissionTime = outcome.admissionTime;
      metric.firstTreatmentTime = outcome.firstTreatmentTime;
    }

    this.logger.log(`[Analytics] Patient outcome recorded for ${routeId}`);
  }

  async getHospitalUtilizationReport() {
    try {
      const result = await this.pool.query(
        `SELECT 
           h.id, h.name, h.level, h.specializations,
           COUNT(DISTINCT a.id) as total_admissions,
           AVG(h.occupied_beds::float / h.total_beds) as avg_occupancy,
           MAX(h.occupied_beds::float / h.total_beds) as peak_occupancy,
           COUNT(CASE WHEN a.status = 'critical' THEN 1 END) as critical_patients,
           COUNT(CASE WHEN a.status = 'stable' THEN 1 END) as stable_patients
         FROM hospitals h
         LEFT JOIN admissions a ON h.id = a.hospital_id 
         WHERE a.created_at > NOW() - INTERVAL '24 hours'
         GROUP BY h.id, h.name, h.level, h.specializations
         ORDER BY total_admissions DESC`
      );

      return result.rows.map(row => ({
        hospitalId: row.id,
        hospitalName: row.name,
        level: row.level,
        specializations: row.specializations,
        totalAdmissions: parseInt(row.total_admissions),
        avgOccupancy: parseFloat(row.avg_occupancy) * 100,
        peakOccupancy: parseFloat(row.peak_occupancy) * 100,
        criticalPatients: parseInt(row.critical_patients),
        stablePatients: parseInt(row.stable_patients)
      }));
    } catch (error) {
      this.logger.error(`Error generating utilization report: ${error.message}`);
      return [];
    }
  }

  async getResponseTimeAnalysis() {
    try {
      const result = await this.pool.query(
        `SELECT 
           h.id, h.name,
           AVG(EXTRACT(EPOCH FROM (a.arrival_time - a.call_time))/60) as avg_response_minutes,
           MIN(EXTRACT(EPOCH FROM (a.arrival_time - a.call_time))/60) as min_response_minutes,
           MAX(EXTRACT(EPOCH FROM (a.arrival_time - a.call_time))/60) as max_response_minutes,
           PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (a.arrival_time - a.call_time))/60) as p95_response
         FROM hospitals h
         LEFT JOIN admissions a ON h.id = a.hospital_id
         WHERE a.call_time > NOW() - INTERVAL '7 days'
         GROUP BY h.id, h.name
         ORDER BY avg_response_minutes ASC`
      );

      return result.rows.map(row => ({
        hospitalId: row.id,
        hospitalName: row.name,
        avgResponseTime: parseFloat(row.avg_response_minutes).toFixed(2),
        minResponseTime: parseFloat(row.min_response_minutes).toFixed(2),
        maxResponseTime: parseFloat(row.max_response_minutes).toFixed(2),
        p95ResponseTime: parseFloat(row.p95_response).toFixed(2)
      }));
    } catch (error) {
      this.logger.error(`Error generating response time analysis: ${error.message}`);
      return [];
    }
  }

  async getLoadDistributionAnalysis() {
    try {
      const result = await this.pool.query(
        `SELECT 
           h.id, h.name,
           COUNT(a.id) as admission_count,
           ROUND(COUNT(a.id) * 100.0 / SUM(COUNT(a.id)) OVER (), 2) as percentage,
           STDDEV(COUNT(a.id) OVER (PARTITION BY DATE(a.call_time))) as daily_variance
         FROM hospitals h
         LEFT JOIN admissions a ON h.id = a.hospital_id
         WHERE a.call_time > NOW() - INTERVAL '7 days'
         GROUP BY h.id, h.name
         ORDER BY admission_count DESC`
      );

      const admissions = result.rows;
      const counts = admissions.map(r => r.admission_count);
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / counts.length;
      const gini = this._calculateGini(counts);

      return {
        hospitals: admissions.map(row => ({
          hospitalId: row.id,
          hospitalName: row.name,
          admissions: row.admission_count,
          sharePercentage: parseFloat(row.percentage)
        })),
        fairnessMetrics: {
          giniCoefficient: gini.toFixed(3),
          standardDeviation: Math.sqrt(variance).toFixed(2),
          interpretation: gini > 0.2 ? 'Unbalanced' : 'Well-balanced'
        }
      };
    } catch (error) {
      this.logger.error(`Error generating load distribution analysis: ${error.message}`);
      return { hospitals: [], fairnessMetrics: {} };
    }
  }

  _calculateGini(values) {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const n = sorted.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    
    let sumAbsDiff = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        sumAbsDiff += Math.abs(sorted[i] - sorted[j]);
      }
    }
    
    return sumAbsDiff / (2 * n * n * mean);
  }

  async getOverrideAnalysis() {
    try {
      // Return override analysis from session metrics
      const overrides = Array.from(this.sessionMetrics.values()).filter(m => m.paramedicsDeviatedFromRecommendation);
      
      const reasonCounts = {};
      overrides.forEach(override => {
        reasonCounts[override.overrideReason] = (reasonCounts[override.overrideReason] || 0) + 1;
      });

      return {
        totalOverrides: overrides.length,
        overrideRate: (overrides.length / this.sessionMetrics.size * 100).toFixed(2),
        reasonBreakdown: reasonCounts,
        details: overrides
      };
    } catch (error) {
      this.logger.error(`Error generating override analysis: ${error.message}`);
      return { totalOverrides: 0, overrideRate: 0, reasonBreakdown: {}, details: [] };
    }
  }

  async getRouteEfficiencyMetrics() {
    try {
      const metrics = Array.from(this.sessionMetrics.values());
      
      if (metrics.length === 0) {
        return { avgScore: 0, efficiency: 0, metrics: [] };
      }

      const avgScore = metrics.reduce((sum, m) => sum + m.recommendedScore, 0) / metrics.length;
      const avgOverride = (Array.from(this.sessionMetrics.values()).filter(m => m.paramedicsDeviatedFromRecommendation).length / metrics.length) * 100;
      
      return {
        totalRoutingDecisions: metrics.length,
        avgRecommendationScore: avgScore.toFixed(2),
        deviationRate: avgOverride.toFixed(2),
        recommendations: avgScore > 85 ? 'Excellent routing decisions' : avgScore > 70 ? 'Good routing' : 'Needs improvement'
      };
    } catch (error) {
      this.logger.error(`Error calculating route efficiency: ${error.message}`);
      return { totalRoutingDecisions: 0, avgScore: 0 };
    }
  }

  async _flushBuffer() {
    if (this.analyticsBuffer.length === 0) return;

    try {
      // Batch insert analytics into database
      for (const metric of this.analyticsBuffer) {
        await this.pool.query(
          `INSERT INTO routing_analytics 
           (route_id, recommended_hospital, recommended_score, patient_condition, severity, override, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            metric.routeId,
            metric.recommendedHospital,
            metric.recommendedScore,
            metric.patientCondition,
            metric.patientSeverity,
            metric.paramedicsDeviatedFromRecommendation,
            metric.overrideReason || null
          ]
        );
      }

      this.logger.log(`[Analytics] Flushed ${this.analyticsBuffer.length} metrics to database`);
      this.analyticsBuffer = [];
    } catch (error) {
      this.logger.error(`Error flushing analytics buffer: ${error.message}`);
    }
  }

  getSessionMetrics(routeId) {
    return this.sessionMetrics.get(routeId);
  }

  getAllSessionMetrics() {
    return Array.from(this.sessionMetrics.values());
  }

  clearSessionMetrics() {
    this.sessionMetrics.clear();
    this.logger.log('[Analytics] Session metrics cleared');
  }
}

module.exports = RoutingAnalytics;
