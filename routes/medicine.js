const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');
const { protect } = require('../middleware/auth');
const { validateResult } = require('../middleware/validateResult');
const { addMedicineValidator, updateMedicineValidator } = require('../validators/medicineValidator');

router.use(protect);

router.post('/', addMedicineValidator, validateResult, medicineController.addMedicine);
router.get('/search', medicineController.searchMedicines);
router.get('/expiring', medicineController.getExpiringMedicines);
router.get('/:id', medicineController.getMedicineById);
router.put('/:id', updateMedicineValidator, validateResult, medicineController.updateMedicine);

module.exports = router;