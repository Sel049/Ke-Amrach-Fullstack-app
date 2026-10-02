import React from 'react';
import Select from '../../../components/ui/Select';
import {
  getRegionOptions as buildRegionOptions,
  getWoredaOptions as buildWoredaOptions
} from '../../../data/ethiopiaLocations';

const LocationSelector = ({ selectedRegion, selectedWoreda, onRegionChange, onWoredaChange, currentLanguage }) => {
  // Region + woreda data is shared with the rest of the app (single source of
  // truth in ../../../data/ethiopiaLocations — 14 regions, 104 zones, 1130 woredas).
  const language = currentLanguage === 'am' ? 'am' : 'en';

  const getRegionOptions = () => buildRegionOptions(language);

  const getWoredaOptions = () => {
    if (!selectedRegion) return [];

    return buildWoredaOptions(selectedRegion);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Select
        label={currentLanguage === 'am' ? 'ክልል' : 'Region'}
        placeholder={currentLanguage === 'am' ? 'ክልል ይምረጡ' : 'Select region'}
        options={getRegionOptions()}
        value={selectedRegion}
        onChange={onRegionChange}
        required
        searchable
      />
      
      <Select
        label={currentLanguage === 'am' ? 'ወረዳ' : 'Woreda'}
        placeholder={currentLanguage === 'am' ? 'ወረዳ ይምረጡ' : 'Select woreda'}
        options={getWoredaOptions()}
        value={selectedWoreda}
        onChange={onWoredaChange}
        disabled={!selectedRegion}
        required
        searchable
      />
    </div>
  );
};

export default LocationSelector;