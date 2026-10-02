import React from 'react';
import { getRegionOptions, getWoredaGroups } from '../../../data/ethiopiaLocations';

const LocationSection = ({ formData, formErrors, onUpdate, currentLanguage }) => {
  const language = currentLanguage === 'am' ? 'am' : 'en';

  // Existing listings may hold legacy free-text values (e.g. region
  // 'Debre Zeit, Oromia' or woreda 'Bahir Dar'). Keep the stored value
  // selectable so the edit form never shows a blank field.
  const preserveStored = (options, stored) => {
    if (!stored) return options;
    if (options.some((option) => option.value === stored || option.label === stored)) return options;
    return [{ value: stored, label: stored }, ...options];
  };

  const regions = preserveStored(getRegionOptions(language), formData.region);
  const woredaGroups = getWoredaGroups(formData.region);
  const woredaInGroups = woredaGroups.some((zone) => zone.woredas.includes(formData.woreda));
  const showStoredWoreda = Boolean(formData.woreda) && !woredaInGroups;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          {currentLanguage === 'en' ? 'Location Details' : 'የአካባቢ ዝርዝሮች'}
        </h2>
        <p className="text-muted-foreground mb-6">
          {currentLanguage === 'en' 
            ? 'Specify where your produce is located for buyers to find you' 
            : 'ገዢዎች እንዲያገኙዎ ምርትዎ የሚገኝበትን ቦታ ይግለጹ'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Region */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {currentLanguage === 'en' ? 'Region *' : 'ክልል *'}
          </label>
          <select
            value={formData.region || ''}
            onChange={(e) => {
              onUpdate('region', e.target.value);
              // Reset woreda when region changes
              onUpdate('woreda', '');
            }}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
              formErrors.region ? 'border-red-500' : 'border-border'
            }`}
          >
            <option value="">
              {currentLanguage === 'en' ? 'Select region' : 'ክልል ይምረጡ'}
            </option>
            {regions.map((region) => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </select>
          {formErrors.region && (
            <p className="mt-1 text-sm text-red-500">{formErrors.region}</p>
          )}
        </div>

        {/* Woreda */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {currentLanguage === 'en' ? 'Woreda *' : 'ወረዳ *'}
          </label>
          <select
            value={formData.woreda || ''}
            onChange={(e) => onUpdate('woreda', e.target.value)}
            disabled={!formData.region}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
              formErrors.woreda ? 'border-red-500' : 'border-border'
            } ${!formData.region ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          >
            <option value="">
              {currentLanguage === 'en' 
                ? (formData.region ? 'Select woreda' : 'Select region first') 
                : (formData.region ? 'ወረዳ ይምረጡ' : 'መጀመሪያ ክልል ይምረጡ')
              }
            </option>
            {showStoredWoreda && (
              <option value={formData.woreda}>{formData.woreda}</option>
            )}
            {woredaGroups.map((zone) => (
              <optgroup key={zone.value} label={zone.label}>
                {zone.woredas.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {formErrors.woreda && (
            <p className="mt-1 text-sm text-red-500">{formErrors.woreda}</p>
          )}
        </div>
      </div>

      {/* Specific Location */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {currentLanguage === 'en' ? 'Specific Location (Optional)' : 'የተወሰነ አካባቢ (አማራጭ)'}
        </label>
        <input
          type="text"
          value={formData.specificLocation || ''}
          onChange={(e) => onUpdate('specificLocation', e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder={currentLanguage === 'en' 
            ? 'e.g., Near Central Market, Behind Post Office' 
            : 'ለምሳሌ: ከመካከለኛ ገበያ አጠገብ፣ ከፖስታ ቤት በስተጀርባ'}
        />
        <p className="mt-1 text-sm text-muted-foreground">
          {currentLanguage === 'en' 
            ? 'Provide additional details to help buyers locate you easily' 
            : 'ገዢዎች በቀላሉ እንዲያገኙዎ ተጨማሪ ዝርዝሮችን ይስጡ'}
        </p>
      </div>

      {/* Location Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              {currentLanguage === 'en' ? 'Location Tips' : 'የአካባቢ ምክሮች'}
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>
                  {currentLanguage === 'en' 
                    ? 'Be as specific as possible to help buyers find you' 
                    : 'ገዢዎች እንዲያገኙዎ በተቻለ መጠን የተወሰነ ይሁኑ'}
                </li>
                <li>
                  {currentLanguage === 'en' 
                    ? 'Include nearby landmarks or major roads' 
                    : 'አጠገባቸው ያሉ ምልክቶች ወይም ዋና መንገዶችን ያካተቱ'}
                </li>
                <li>
                  {currentLanguage === 'en' 
                    ? 'Consider accessibility for delivery or pickup' 
                    : 'ለማድረስ ወይም ለመውሰድ ተደራሽነትን ያስቡ'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationSection;
