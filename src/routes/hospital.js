/**
 * Hospital Routes
 * Hospital dispatch console and capacity management
 */

const express = require('express');
const router = express.Router();

let ankaraData;
let ambulancesMap;
let broadcastFunc;

function initializeRoutes(deps) {
  ankaraData = deps.ankaraData;
  ambulancesMap = deps.ambulances;
  broadcastFunc = deps.broadcast;
}

/**
 * GET /api/hospitals
 * List all hospitals with capacity
 */
router.get('/', (req, res) => {
  try {
    const hospitals = ankaraData.getHospitals();
    const capacityStatus = ankaraData.getHospitalCapacityStatus();

    const hospitalsWithCapacity = hospitals.map(h => {
      const capacity = capacityStatus.find(c => c.id === h.id);
      return { ...h, ...capacity };
    });

    res.json({
      count: hospitalsWithCapacity.length,
      hospitals: hospitalsWithCapacity
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/hospitals/:id
 * Get specific hospital details
 */
router.get('/:id', (req, res) => {
  try {
    const hospital = ankaraData.getHospital(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    // Get incoming ambulances for this hospital
    const incomingAmbulances = Array.from(ambulancesMap.values()).filter(
      a => a.hospitalId === req.params.id && a.status !== 'AVAILABLE'
    );

    res.json({
      hospital,
      incomingAmbulances: incomingAmbulances.length,
      ambulances: incomingAmbulances
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/hospitals/search
 * Search hospitals by criteria
 */
router.get('/search/criteria', (req, res) => {
  try {
    const { district, specialty, minBeds } = req.query;

    const results = ankaraData.searchHospitals({
      district: district || undefined,
      specialty: specialty || undefined,
      minBeds: minBeds ? parseInt(minBeds) : undefined
    });

    res.json({
      count: results.length,
      hospitals: results
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/hospitals/:id/dispatch-console
 * Hospital dispatch console view
 */
router.get('/:id/dispatch-console', (req, res) => {
  try {
    const hospital = ankaraData.getHospital(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const incomingAmbulances = Array.from(ambulancesMap.values())
      .filter(a => a.hospitalId === req.params.id && a.status !== 'AVAILABLE')
      .map(a => ({
        id: a.id,
        patientName: a.patientName,
        patientAge: a.patientAge,
        triageLevel: a.triageLevel,
        triageScore: a.triageScore,
        vitals: a.vitals,
        status: a.status,
        eta: a.route?.estimatedTime?.totalTimeMinutes || 'Unknown'
      }));

    res.json({
      hospital,
      dispatchConsole: {
        incomingAmbulances: incomingAmbulances.length,
        ambulances: incomingAmbulances,
        totalBeds: hospital.beds,
        erBeds: hospital.erBeds,
        criticalBeds: Math.floor(hospital.erBeds * 0.3),
        availableBeds: Math.floor(hospital.beds * (1 - Math.random() * 0.7))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/hospitals/:id/prepare-bay
 * Prepare specific ER bay for incoming patient
 */
router.post('/:id/prepare-bay', (req, res) => {
  try {
    const { ambulanceId, bayNumber, equipment } = req.body;
    const hospital = ankaraData.getHospital(req.params.id);
    const ambulance = ambulancesMap.get(ambulanceId);

    if (!hospital || !ambulance) {
      return res.status(404).json({ error: 'Hospital or ambulance not found' });
    }

    const preparation = {
      ambulanceId,
      hospitalId: req.params.id,
      bayNumber: bayNumber || Math.floor(Math.random() * 10) + 1,
      equipment: equipment || ['Monitor', 'IV Stand', 'Oxygen', 'Ventilator'],
      status: 'READY',
      preparedAt: new Date().toISOString()
    };

    broadcastFunc({
      type: 'HOSPITAL_BAY_READY',
      hospital: hospital.name,
      ambulanceId,
      preparation
    });

    res.json({
      success: true,
      preparation
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, initializeRoutes };
