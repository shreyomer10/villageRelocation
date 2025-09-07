// src/services/familyService.js
import { apiRequest } from '../config/api';

export const familyService = {
  // Fetch beneficiaries for a specific village
  getBeneficiaries: async (villageId, option = null) => {
    const params = {};
    if (option && option !== 'All') {
      if (option === 'Option 1') params.option = '1';
      if (option === 'Option 2') params.option = '2';
    }
    
    try {
      const result = await apiRequest(
        `/family/villages/${villageId}/beneficiaries`,
        { params }
      );
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching beneficiaries:', error);
      throw error;
    }
  },

  // Fetch detailed family information
  getFamilyDetails: async (familyId) => {
    try {
      const result = await apiRequest(`/family/families/${familyId}`);
      return result;
    } catch (error) {
      console.error('Error fetching family details:', error);
      throw error;
    }
  }
};
    
export default familyService;