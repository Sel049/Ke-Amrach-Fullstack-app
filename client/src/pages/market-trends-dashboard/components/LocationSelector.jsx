import React, { useState, useEffect } from 'react';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';
import { getRegionOptions, getWoredaOptions, getWoredas } from '../../../data/ethiopiaLocations';

const DEFAULT_REGION = 'addis-ababa';

const LocationSelector = ({ onLocationChange, currentLanguage = 'en' }) => {
  const language = currentLanguage === 'am' ? 'am' : 'en';
  const [selectedRegion, setSelectedRegion] = useState(DEFAULT_REGION);
  const [selectedWoreda, setSelectedWoreda] = useState(() => getWoredas(DEFAULT_REGION)[0] || '');


  const handleRegionChange = (value) => {
    setSelectedRegion(value);
    const firstWoreda = getWoredas(value)[0] || '';
    setSelectedWoreda(firstWoreda);
    
    if (onLocationChange) {
      onLocationChange({
        region: value,
        woreda: firstWoreda
      });
    }
  };

  const handleWoredaChange = (value) => {
    setSelectedWoreda(value);
    
    if (onLocationChange) {
      onLocationChange({
        region: selectedRegion,
        woreda: value
      });
    }
  };

  useEffect(() => {
    if (onLocationChange) {
      onLocationChange({
        region: selectedRegion,
        woreda: selectedWoreda
      });
    }
  }, []);

  const regionOptions = getRegionOptions(language);

  const woredaOptions = getWoredaOptions(selectedRegion);

  return (
    <div className="bg-surface p-4 lg:p-6 rounded-lg border border-border shadow-warm">
      <div className="flex items-center space-x-2 mb-4">
        <Icon name="MapPin" size={20} className="text-primary" />
        <h3 className="text-lg font-semibold text-text-primary">
          {currentLanguage === 'am' ? 'ቦታ ምረጥ' : 'Select Location'}
        </h3>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Select
          label={currentLanguage === 'am' ? 'ክልል' : 'Region'}
          options={regionOptions}
          value={selectedRegion}
          onChange={handleRegionChange}
          placeholder={currentLanguage === 'am' ? 'ክልል ምረጥ' : 'Select region'}
        />
        
        <Select
          label={currentLanguage === 'am' ? 'ወረዳ' : 'Woreda'}
          options={woredaOptions}
          value={selectedWoreda}
          onChange={handleWoredaChange}
          placeholder={currentLanguage === 'am' ? 'ወረዳ ምረጥ' : 'Select woreda'}
          disabled={!selectedRegion}
        />
      </div>
    </div>
  );
};

export default LocationSelector;