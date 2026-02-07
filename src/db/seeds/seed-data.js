/**
 * Seed Data for 5G Emergency Response Network
 * Realistic Ankara hospitals, ambulance stations, users, and test data
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('../pool');

// Ankara hospitals with real coordinates
const ANKARA_HOSPITALS = [
  {
    name: 'Ankara Education and Research Hospital',
    address: 'Dışkapı Cad., Ankara',
    latitude: 39.9376,
    longitude: 32.8656,
    phone: '+90 312 595 3000',
    email: 'info@ankara-h.gov.tr',
    total_beds: 850,
    available_beds: 320,
    icu_beds: 120,
    trauma_beds: 80,
    burn_beds: 30,
    pediatric_beds: 60,
    has_trauma_center: true,
    has_cardiac_center: true,
    has_stroke_center: true,
    has_burn_center: true,
    district: 'Keçiören'
  },
  {
    name: 'Ankara University Hospital',
    address: 'Sıhhiye, Ankara',
    latitude: 39.9272,
    longitude: 32.8641,
    phone: '+90 312 595 5000',
    email: 'info@ankara-uni.gov.tr',
    total_beds: 900,
    available_beds: 280,
    icu_beds: 150,
    trauma_beds: 100,
    burn_beds: 40,
    pediatric_beds: 80,
    has_trauma_center: true,
    has_cardiac_center: true,
    has_stroke_center: true,
    has_burn_center: true,
    district: 'Çankaya'
  },
  {
    name: 'Ankara Numune Hospital',
    address: 'Samanpazarı, Ankara',
    latitude: 39.9458,
    longitude: 32.8564,
    phone: '+90 312 568 0000',
    email: 'info@numune-ankara.gov.tr',
    total_beds: 650,
    available_beds: 200,
    icu_beds: 80,
    trauma_beds: 60,
    burn_beds: 20,
    pediatric_beds: 50,
    has_trauma_center: true,
    has_cardiac_center: true,
    has_stroke_center: false,
    has_burn_center: false,
    district: 'Çankaya'
  },
  {
    name: 'Ankara Occupational Diseases Hospital',
    address: 'Kızılay, Ankara',
    latitude: 39.9393,
    longitude: 32.8678,
    phone: '+90 312 306 2500',
    email: 'info@mesleki-ankara.gov.tr',
    total_beds: 200,
    available_beds: 85,
    icu_beds: 25,
    trauma_beds: 20,
    burn_beds: 10,
    pediatric_beds: 15,
    has_trauma_center: false,
    has_cardiac_center: false,
    has_stroke_center: false,
    has_burn_center: false,
    district: 'Keçiören'
  },
  {
    name: 'Gülhane Military Medical Academy Hospital',
    address: 'Haydarpasha, Ankara',
    latitude: 39.9324,
    longitude: 32.8712,
    phone: '+90 312 304 5000',
    email: 'info@gata-ankara.mil.tr',
    total_beds: 750,
    available_beds: 250,
    icu_beds: 100,
    trauma_beds: 75,
    burn_beds: 35,
    pediatric_beds: 60,
    has_trauma_center: true,
    has_cardiac_center: true,
    has_stroke_center: true,
    has_burn_center: true,
    district: 'Çankaya'
  }
];

// Ambulance stations in Ankara
const ANKARA_STATIONS = [
  {
    name: 'Central Station',
    address: 'Kizilay, Ankara',
    latitude: 39.9393,
    longitude: 32.8678,
    phone: '+90 312 425 0000',
    total_ambulances: 25,
    available_ambulances: 18,
    district: 'Keçiören'
  },
  {
    name: 'Çankaya Station',
    address: 'Çankaya, Ankara',
    latitude: 39.9272,
    longitude: 32.8641,
    phone: '+90 312 426 0000',
    total_ambulances: 20,
    available_ambulances: 15,
    district: 'Çankaya'
  },
  {
    name: 'Cebeci Station',
    address: 'Cebeci, Ankara',
    latitude: 39.9458,
    longitude: 32.8564,
    phone: '+90 312 427 0000',
    total_ambulances: 18,
    available_ambulances: 12,
    district: 'Çankaya'
  },
  {
    name: 'Keçiören Station',
    address: 'Keçiören, Ankara',
    latitude: 39.9376,
    longitude: 32.8656,
    phone: '+90 312 428 0000',
    total_ambulances: 22,
    available_ambulances: 16,
    district: 'Keçiören'
  },
  {
    name: 'Mamak Station',
    address: 'Mamak, Ankara',
    latitude: 39.9324,
    longitude: 32.8712,
    phone: '+90 312 429 0000',
    total_ambulances: 15,
    available_ambulances: 11,
    district: 'Mamak'
  }
];

// Seed hospitals
async function seedHospitals() {
  console.log('[DB] Seeding hospitals...');
  
  for (const hospital of ANKARA_HOSPITALS) {
    await pool.query(
      `INSERT INTO hospitals 
       (name, address, latitude, longitude, phone, email, total_beds, available_beds, 
        icu_beds, trauma_beds, burn_beds, pediatric_beds, has_trauma_center, 
        has_cardiac_center, has_stroke_center, has_burn_center, district, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        hospital.name,
        hospital.address,
        hospital.latitude,
        hospital.longitude,
        hospital.phone,
        hospital.email,
        hospital.total_beds,
        hospital.available_beds,
        hospital.icu_beds,
        hospital.trauma_beds,
        hospital.burn_beds,
        hospital.pediatric_beds,
        hospital.has_trauma_center,
        hospital.has_cardiac_center,
        hospital.has_stroke_center,
        hospital.has_burn_center,
        hospital.district,
        'OPERATIONAL'
      ]
    );
  }
  
  console.log(`[DB] ✓ Seeded ${ANKARA_HOSPITALS.length} hospitals`);
}

// Seed ambulance stations
async function seedAmbulanceStations() {
  console.log('[DB] Seeding ambulance stations...');
  
  for (const station of ANKARA_STATIONS) {
    await pool.query(
      `INSERT INTO ambulance_stations
       (name, address, latitude, longitude, phone, total_ambulances, available_ambulances, district)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        station.name,
        station.address,
        station.latitude,
        station.longitude,
        station.phone,
        station.total_ambulances,
        station.available_ambulances,
        station.district
      ]
    );
  }
  
  console.log(`[DB] ✓ Seeded ${ANKARA_STATIONS.length} ambulance stations`);
}

// Seed users (paramedics, dispatchers, hospital staff)
async function seedUsers() {
  console.log('[DB] Seeding users...');
  
  const users = [
    // Dispatchers
    { email: 'dispatcher1@ankara-ern.tr', name: 'Ahmet Yılmaz', role: 'dispatcher', phone: '0312-xxx-xxxx' },
    { email: 'dispatcher2@ankara-ern.tr', name: 'Fatma Kaya', role: 'dispatcher', phone: '0312-xxx-xxxx' },
    { email: 'dispatcher3@ankara-ern.tr', name: 'Mustafa Demir', role: 'dispatcher', phone: '0312-xxx-xxxx' },
    
    // Paramedics
    { email: 'paramedic1@ankara-ern.tr', name: 'Ali Çelik', role: 'paramedic', phone: '0312-xxx-xxxx' },
    { email: 'paramedic2@ankara-ern.tr', name: 'Zeynep Şahin', role: 'paramedic', phone: '0312-xxx-xxxx' },
    { email: 'paramedic3@ankara-ern.tr', name: 'Mehmet Polat', role: 'paramedic', phone: '0312-xxx-xxxx' },
    { email: 'paramedic4@ankara-ern.tr', name: 'Ayşe Kır', role: 'paramedic', phone: '0312-xxx-xxxx' },
    { email: 'paramedic5@ankara-ern.tr', name: 'Hasan Kılıç', role: 'paramedic', phone: '0312-xxx-xxxx' },
    { email: 'paramedic6@ankara-ern.tr', name: 'Seda Yıldız', role: 'paramedic', phone: '0312-xxx-xxxx' },
    { email: 'paramedic7@ankara-ern.tr', name: 'Kerem Özdemir', role: 'paramedic', phone: '0312-xxx-xxxx' },
    
    // Hospital staff
    { email: 'admin1@ankara-hosp.tr', name: 'Dr. İbrahim Açar', role: 'hospital_admin', phone: '0312-xxx-xxxx' },
    { email: 'admin2@ankara-hosp.tr', name: 'Dr. Gül Ayan', role: 'hospital_admin', phone: '0312-xxx-xxxx' },
    { email: 'doctor1@ankara-hosp.tr', name: 'Prof. Nur Aydın', role: 'doctor', phone: '0312-xxx-xxxx' },
    { email: 'doctor2@ankara-hosp.tr', name: 'Doç. Tarık Şen', role: 'doctor', phone: '0312-xxx-xxxx' }
  ];
  
  for (const user of users) {
    await pool.query(
      `INSERT INTO users (email, name, role, phone, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [user.email, user.name, user.role, user.phone]
    );
  }
  
  console.log(`[DB] ✓ Seeded ${users.length} users`);
}

// Seed ambulances
async function seedAmbulances() {
  console.log('[DB] Seeding ambulances...');
  
  // Get all stations
  const stationsResult = await pool.query('SELECT id FROM ambulance_stations ORDER BY name');
  const stations = stationsResult.rows;
  
  let ambulanceIndex = 1;
  for (let i = 0; i < stations.length; i++) {
    const stationId = stations[i].id;
    const stationAmbulances = [2, 2, 2, 2, 2];
    
    for (let j = 0; j < stationAmbulances[i]; j++) {
      const callSign = `AMB-${String(ambulanceIndex).padStart(3, '0')}`;
      const licensePlate = `34-${String(ambulanceIndex).padStart(5, '0')}`;
      
      await pool.query(
        `INSERT INTO ambulances 
         (call_sign, station_id, license_plate, vin, model, year, ambulance_type, status, fuel_level, battery_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          callSign,
          stationId,
          licensePlate,
          `VIN${ambulanceIndex}`,
          'Mercedes-Benz Sprinter',
          2022,
          'TYPE_A',
          'AVAILABLE',
          Math.floor(Math.random() * 40) + 60,
          Math.floor(Math.random() * 20) + 80
        ]
      );
      
      ambulanceIndex++;
    }
  }
  
  console.log('[DB] ✓ Seeded 10 ambulances');
}

// Seed patients
async function seedPatients() {
  console.log('[DB] Seeding test patients...');
  
  const patients = [
    {
      name: 'Emre Değirmenci',
      age: 65,
      gender: 'M',
      blood_type: 'O+',
      phone: '0532-xxx-xxxx',
      address: 'Keçiören, Ankara',
      emergency_contact_name: 'Elif Değirmenci',
      emergency_contact_phone: '0532-xxx-xxxx',
      emergency_contact_relation: 'Daughter',
      medical_conditions: 'Hypertension, Type 2 Diabetes',
      allergies: 'Penicillin',
      current_medications: 'Lisinopril, Metformin'
    },
    {
      name: 'Ayşe Polat',
      age: 42,
      gender: 'F',
      blood_type: 'A+',
      phone: '0534-xxx-xxxx',
      address: 'Çankaya, Ankara',
      emergency_contact_name: 'Musa Polat',
      emergency_contact_phone: '0534-xxx-xxxx',
      emergency_contact_relation: 'Husband',
      medical_conditions: 'Asthma',
      allergies: 'Aspirin',
      current_medications: 'Albuterol Inhaler'
    },
    {
      name: 'Mehmet Yıldız',
      age: 28,
      gender: 'M',
      blood_type: 'B+',
      phone: '0535-xxx-xxxx',
      address: 'Cebeci, Ankara',
      emergency_contact_name: 'Fatma Yıldız',
      emergency_contact_phone: '0535-xxx-xxxx',
      emergency_contact_relation: 'Mother',
      medical_conditions: 'None',
      allergies: 'None',
      current_medications: 'None'
    }
  ];
  
  for (const patient of patients) {
    await pool.query(
      `INSERT INTO patients 
       (name, age, gender, blood_type, phone, address, emergency_contact_name, 
        emergency_contact_phone, emergency_contact_relation, medical_conditions, allergies, current_medications)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        patient.name,
        patient.age,
        patient.gender,
        patient.blood_type,
        patient.phone,
        patient.address,
        patient.emergency_contact_name,
        patient.emergency_contact_phone,
        patient.emergency_contact_relation,
        patient.medical_conditions,
        patient.allergies,
        patient.current_medications
      ]
    );
  }
  
  console.log(`[DB] ✓ Seeded ${patients.length} test patients`);
}

module.exports = {
  seedHospitals,
  seedAmbulanceStations,
  seedUsers,
  seedAmbulances,
  seedPatients
};