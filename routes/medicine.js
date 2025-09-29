const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');
const { protect } = require('../middleware/auth');
const { validateResult } = require('../middleware/validateResult');
const { addMedicineValidator } = require('../validators/medicineValidator');

router.use(protect);

router.post('/', addMedicineValidator, validateResult, medicineController.addMedicine);
router.get('/search', medicineController.searchMedicines);
router.get('/expiring', medicineController.getExpiringMedicines); // New route
router.get('/:id', medicineController.getMedicineById);
router.put('/:id', addMedicineValidator, validateResult, medicineController.updateMedicine);

module.exports = router;