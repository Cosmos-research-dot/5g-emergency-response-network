/**
 * Ambulance Route Tests
 */

const request = require('supertest');
const server = require('../src/server');

describe('Ambulance Routes', () => {
  afterAll((done) => {
    server.close(done);
  });

  describe('POST /api/ambulance/dispatch', () => {
    it('should dispatch a new ambulance', (done) => {
      request(server)
        .post('/api/ambulance/dispatch')
        .send({
          patientName: 'Test Patient',
          latitude: 39.93,
          longitude: 32.85,
          patientAge: 45,
          condition: 'stable'
        })
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(res.body.ambulanceId).toBeDefined();
          expect(res.body.ambulance.status).toBe('DISPATCHED');
          done();
        });
    });

    it('should require latitude and longitude', (done) => {
      request(server)
        .post('/api/ambulance/dispatch')
        .send({
          patientName: 'Test Patient'
        })
        .expect(400)
        .end(done);
    });
  });

  describe('GET /api/ambulance', () => {
    it('should list all ambulances', (done) => {
      request(server)
        .get('/api/ambulance')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(Array.isArray(res.body.ambulances)).toBe(true);
          expect(res.body.count).toBeDefined();
          done();
        });
    });
  });

  describe('GET /api/ambulance/:id', () => {
    it('should return 404 for non-existent ambulance', (done) => {
      request(server)
        .get('/api/ambulance/nonexistent')
        .expect(404)
        .end(done);
    });
  });
});
