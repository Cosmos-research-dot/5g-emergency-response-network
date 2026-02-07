/**
 * Notification Templates Seed Data
 */

const pool = require('../pool');

const templates = [
  {
    code: 'dispatch_new_call',
    name: 'New Emergency Dispatch',
    category: 'dispatch',
    priority: 'critical',
    requires_acknowledgment: true,
    acknowledgment_timeout_seconds: 30,
    push_title: '🚨 New Emergency Call',
    push_body: 'New dispatch received. Patient at {{location}}. Severity: {{severity}}',
    sms_template: '🚨 CRITICAL: New dispatch at {{location}}. Severity: {{severity}}. Reply Y to accept.',
    whatsapp_template: '🚨 *NEW EMERGENCY DISPATCH*\n\n📍 Location: {{location}}\n⚠️ Severity: {{severity}}\n👤 Patient: {{patient_name}}\n\nReply: YES to accept, NO to decline',
    email_subject: '[CRITICAL] New Emergency Dispatch - {{severity}} Priority',
    email_body: 'New emergency dispatch assigned to you.\n\nLocation: {{location}}\nSeverity: {{severity}}\nPatient: {{patient_name}}\nMedical History: {{medical_history}}\nAllergies: {{allergies}}\n\nPlease respond immediately.',
    inapp_title: '🚨 New Emergency Call',
    inapp_body: 'Patient at {{location}} requires immediate assistance ({{severity}})',
    variables: {
      location: 'string',
      severity: 'enum:Critical,Urgent,Normal,Low',
      patient_name: 'string',
      medical_history: 'text',
      allergies: 'string'
    }
  },
  {
    code: 'dispatch_accepted',
    name: 'Dispatch Accepted Confirmation',
    category: 'dispatch',
    priority: 'normal',
    requires_acknowledgment: false,
    push_title: '✅ Dispatch Accepted',
    push_body: 'Ambulance {{ambulance_id}} accepted dispatch. ETA: {{eta}}',
    sms_template: '✅ Dispatch accepted. Ambulance {{ambulance_id}} en route. ETA: {{eta}}',
    whatsapp_template: '✅ *DISPATCH ACCEPTED*\n\n🚑 Ambulance: {{ambulance_id}}\n⏱️ ETA: {{eta}}\n📍 Route: {{route_summary}}',
    email_subject: 'Dispatch Accepted - {{ambulance_id}}',
    email_body: 'Your dispatch has been accepted.\n\nAmbulance: {{ambulance_id}}\nETA: {{eta}}\nRoute: {{route_summary}}',
    inapp_title: '✅ Dispatch Accepted',
    inapp_body: 'Ambulance {{ambulance_id}} accepted (ETA: {{eta}})',
    variables: {
      ambulance_id: 'string',
      eta: 'string',
      route_summary: 'string'
    }
  },
  {
    code: 'vital_alert_critical',
    name: 'Critical Vital Sign Alert',
    category: 'paramedic',
    priority: 'critical',
    requires_acknowledgment: true,
    acknowledgment_timeout_seconds: 60,
    push_title: '🚨 Critical Vital Signs',
    push_body: '{{vital_type}} critical: {{vital_value}}. Patient: {{patient_name}}',
    sms_template: '🚨 CRITICAL: {{vital_type}} = {{vital_value}}. Patient {{patient_name}}. Reply to confirm.',
    whatsapp_template: '🚨 *CRITICAL VITAL ALERT*\n\n⚠️ {{vital_type}}: {{vital_value}}\n👤 Patient: {{patient_name}}\n⏱️ Time: {{timestamp}}\n\nReply: CONFIRM or CALL 911',
    email_subject: '[CRITICAL] Patient Vital Alert - {{vital_type}}',
    email_body: 'CRITICAL: {{vital_type}} = {{vital_value}}\n\nPatient: {{patient_name}}\nTime: {{timestamp}}\nLocation: {{location}}\nETA to Hospital: {{eta}}',
    inapp_title: '🚨 Critical Vital Signs',
    inapp_body: '{{vital_type}}: {{vital_value}} - Patient {{patient_name}}',
    variables: {
      vital_type: 'enum:Heart Rate,Blood Pressure,Oxygen Saturation,Temperature,Glucose',
      vital_value: 'string',
      patient_name: 'string',
      timestamp: 'datetime',
      location: 'string',
      eta: 'string'
    }
  },
  {
    code: 'ambulance_arrival_hospital',
    name: 'Ambulance Arrival at Hospital',
    category: 'hospital',
    priority: 'urgent',
    requires_acknowledgment: true,
    acknowledgment_timeout_seconds: 60,
    push_title: '🚑 Ambulance Arriving',
    push_body: 'Ambulance {{ambulance_id}} arriving in {{eta}}. Patient: {{patient_name}}',
    sms_template: '🚑 Ambulance {{ambulance_id}} arriving in {{eta}}. Severity: {{severity}}. Bay {{bay}} ready.',
    whatsapp_template: '🚑 *AMBULANCE ARRIVING*\n\n📍 Location: {{ambulance_location}}\n⏱️ ETA: {{eta}}\n👤 Patient: {{patient_name}}\n⚠️ Severity: {{severity}}\n\nReply: READY or NEED DELAY',
    email_subject: 'Incoming Ambulance - {{ambulance_id}} - {{severity}}',
    email_body: 'Incoming ambulance alert:\n\nAmbulance: {{ambulance_id}}\nETA: {{eta}}\nPatient: {{patient_name}}\nSeverity: {{severity}}\nMedical Info: {{medical_summary}}\nAllergies: {{allergies}}',
    inapp_title: '🚑 Ambulance Arriving',
    inapp_body: 'Ambulance arriving in {{eta}} with {{patient_name}} ({{severity}})',
    variables: {
      ambulance_id: 'string',
      eta: 'string',
      patient_name: 'string',
      severity: 'enum:Critical,Urgent,Normal,Low',
      medical_summary: 'text',
      allergies: 'string',
      ambulance_location: 'string',
      bay: 'string'
    }
  },
  {
    code: 'patient_handoff_complete',
    name: 'Patient Handoff Complete',
    category: 'dispatcher',
    priority: 'normal',
    requires_acknowledgment: false,
    push_title: '✅ Patient Handoff Complete',
    push_body: 'Patient {{patient_name}} handed off to {{hospital_name}}',
    sms_template: '✅ Patient {{patient_name}} handed off at {{hospital_name}}. Ambulance {{ambulance_id}} available.',
    whatsapp_template: '✅ *PATIENT HANDOFF COMPLETE*\n\n👤 Patient: {{patient_name}}\n🏥 Hospital: {{hospital_name}}\n🚑 Ambulance {{ambulance_id}} available\n⏱️ Handoff time: {{handoff_time}}',
    email_subject: 'Patient Handoff Complete - {{patient_name}}',
    email_body: 'Patient handoff completed:\n\nPatient: {{patient_name}}\nHospital: {{hospital_name}}\nArrival Time: {{arrival_time}}\nHandoff Time: {{handoff_time}}\nAmbulance: {{ambulance_id}}',
    inapp_title: '✅ Patient Handoff Complete',
    inapp_body: '{{patient_name}} handed off to {{hospital_name}}',
    variables: {
      patient_name: 'string',
      hospital_name: 'string',
      ambulance_id: 'string',
      handoff_time: 'datetime',
      arrival_time: 'datetime'
    }
  },
  {
    code: 'route_change',
    name: 'Route Change Notification',
    category: 'paramedic',
    priority: 'normal',
    requires_acknowledgment: true,
    acknowledgment_timeout_seconds: 30,
    push_title: '📍 Route Changed',
    push_body: 'New route to {{destination}}. ETA: {{eta}}',
    sms_template: '📍 Route updated. New destination: {{destination}}. ETA: {{eta}}',
    whatsapp_template: '📍 *ROUTE CHANGED*\n\n📍 New Destination: {{destination}}\n⏱️ ETA: {{eta}}\n🗺️ Distance: {{distance}}',
    email_subject: 'Route Change Notification',
    email_body: 'Your route has been updated.\n\nNew Destination: {{destination}}\nETA: {{eta}}\nDistance: {{distance}}',
    inapp_title: '📍 Route Changed',
    inapp_body: 'Route updated to {{destination}} (ETA: {{eta}})',
    variables: {
      destination: 'string',
      eta: 'string',
      distance: 'string'
    }
  }
];

async function seedNotificationTemplates() {
  try {
    console.log('[Seed] Inserting notification templates...');

    for (const template of templates) {
      await pool.query(`
        INSERT INTO notification_templates (
          code, name, category, priority, requires_acknowledgment,
          acknowledgment_timeout_seconds, push_title, push_body,
          sms_template, whatsapp_template, email_subject, email_body,
          inapp_title, inapp_body, variables
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (code) DO UPDATE SET
          push_title = EXCLUDED.push_title,
          push_body = EXCLUDED.push_body,
          sms_template = EXCLUDED.sms_template,
          updated_at = CURRENT_TIMESTAMP
      `, [
        template.code,
        template.name,
        template.category,
        template.priority,
        template.requires_acknowledgment,
        template.acknowledgment_timeout_seconds,
        template.push_title,
        template.push_body,
        template.sms_template,
        template.whatsapp_template,
        template.email_subject,
        template.email_body,
        template.inapp_title,
        template.inapp_body,
        JSON.stringify(template.variables)
      ]);
    }

    console.log(`[Seed] ✓ Inserted ${templates.length} notification templates`);
  } catch (error) {
    console.error('[Seed] Template insertion failed:', error.message);
    throw error;
  }
}

module.exports = { seedNotificationTemplates };