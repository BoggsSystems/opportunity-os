const jwt = require('jsonwebtoken');
const secret = 'local-development-jwt-secret-1234567890';
const payload = {
  sub: 'b7d60c45-0cd6-45db-bdc8-6fd4b1dc084d',
  email: 'demo-1777232100276@opportunity-os.com',
  id: 'b7d60c45-0cd6-45db-bdc8-6fd4b1dc084d'
};
const token = jwt.sign(payload, secret, { expiresIn: '1h' });
console.log(token);
