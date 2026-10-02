import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const FilterPanel = ({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  currentLanguage = 'en',
  selectedCategory = 'all',
  selectedRegion = 'all',
  currentSort = 'relevance',
  categoryOptions = [],
  regionOptions = []
}) => {
  const emptyFilters = {
    produceTypes: [],
    regions: [],
    priceRange: { min: '', max: '' },
    verifiedOnly: false
  };
  const [localFilters, setLocalFilters] = useState(filters || emptyFilters);
  const [localCategory, setLocalCategory] = useState(selectedCategory);
  const [localRegion, setLocalRegion] = useState(selectedRegion);
  const [localSort, setLocalSort] = useState(currentSort);

  useEffect(() => {
    setLocalFilters(filters || emptyFilters);
    setLocalCategory(selectedCategory);
    setLocalRegion(selectedRegion);
    setLocalSort(currentSort);
  }, [filters, selectedCategory, selectedRegion, currentSort]);

  // Escape closes the panel (desktop bar and mobile drawer alike)
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event) => {
      if (event?.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const translations = {
    en: {
      filters: 'Filters',
      clearAll: 'Clear All',
      apply: 'Apply Filters',
      produceType: 'Produce Type',
      location: 'Location',
      priceRange: 'Price Range (ETB)',
      verification: 'Farmer Verification',
      verified: 'Verified Farmers Only',
      minPrice: 'Min Price',
      maxPrice: 'Max Price',
      regions: {
        addisAbaba: 'Addis Ababa', oromia: 'Oromia', amhara: 'Amhara',
        tigray: 'Tigray', snnp: 'SNNP', somali: 'Somali',
        afar: 'Afar', benishangul: 'Benishangul-Gumuz', gambela: 'Gambela',
        harari: 'Harari', direDawa: 'Dire Dawa'
      },
      produces: {
        teff: 'Teff', wheat: 'Wheat', barley: 'Barley', maize: 'Maize',
        sorghum: 'Sorghum', coffee: 'Coffee', sesame: 'Sesame',
        beans: 'Beans', chickpeas: 'Chickpeas', lentils: 'Lentils'
      }
    },
    am: {
      filters: 'ማጣሪያዎች', clearAll: 'ሁሉንም አጽዳ', apply: 'ማጣሪያዎችን ተግብር',
      produceType: 'የምርት አይነት', location: 'አካባቢ',
      priceRange: 'የዋጋ ክልል (ብር)', verification: 'የገበሬ ማረጋገጫ',
      verified: 'የተረጋገጡ ገበሬዎች ብቻ', minPrice: 'ዝቅተኛ ዋጋ', maxPrice: 'ከፍተኛ ዋጋ',
      regions: { addisAbaba: 'አዲስ አበባ', oromia: 'ኦሮሚያ', amhara: 'አማራ',
        tigray: 'ትግራይ', snnp: 'ደቡብ ብሔሮች', somali: 'ሶማሊ',
        afar: 'አፋር', benishangul: 'ቤንሻንጉል ጉሙዝ', gambela: 'ጋምቤላ',
        harari: 'ሐረሪ', direDawa: 'ድሬዳዋ' },
      produces: { teff: 'ጤፍ', wheat: 'ስንዴ', barley: 'ገብስ', maize: 'በቆሎ',
        sorghum: 'ማሽላ', coffee: 'ቡና', sesame: 'ሰሊጥ',
        beans: 'ባቄላ', chickpeas: 'ሽምብራ', lentils: 'ምስር' }
    }
  };

  const t = translations?.[currentLanguage];
  const builtCategoryOptions = categoryOptions?.length > 0 ? categoryOptions : [{ id: 'all', label: currentLanguage === 'am' ? 'ሁሉም' : 'All' }];
  const builtRegionOptions = regionOptions?.length > 0 ? regionOptions : [{ id: 'all', label: currentLanguage === 'am' ? 'ሁሉም' : 'All' }];

  const sortOptions = [
    { id: 'relevance', label: currentLanguage === 'am' ? 'ተዛማጅነት' : 'Relevance' },
    { id: 'newest', label: currentLanguage === 'am' ? 'አዲስ' : 'Newest' },
    { id: 'priceLowHigh', label: currentLanguage === 'am' ? 'ዋጋ: ዝቅ ወደ ከፍ' : 'Price: Low → High' },
    { id: 'priceHighLow', label: currentLanguage === 'am' ? 'ዋጋ: ከፍ ወደ ዝቅ' : 'Price: High → Low' },
  ];

  // Shared styling for the horizontal desktop filter bar
  const desktopLabelClass = 'mb-1 block text-xs font-medium text-text-secondary';
  const desktopControlClass = 'h-10 w-full rounded-full border border-border bg-white px-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';
  // Min/max price boxes deliberately use a normal (non-pill) border — the curved
  // `rounded-full` border made the digits hard to read. `tabular-nums` keeps the
  // numbers aligned while typing and `flex-1` gives both boxes equal width.
  const priceInputClass = 'h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-3 text-sm text-text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

  const handlePriceChange = (type, value) => {
    setLocalFilters(prev => ({
      ...prev,
      priceRange: { ...prev.priceRange, [type]: value || '' }
    }));
  };

  const handleCategoryChange = (category) => {
    setLocalCategory(category);
    setLocalFilters(prev => ({
      ...prev,
      produceTypes: category === 'all' ? [] : [category]
    }));
  };

  const handleRegionChange = (region) => {
    setLocalRegion(region);
    setLocalFilters(prev => ({
      ...prev,
      regions: region === 'all' ? [] : [region]
    }));
  };

  const handleVerificationChange = (verifiedOnly) => {
    setLocalFilters(prev => ({ ...prev, verifiedOnly }));
  };

  const handleSortChange = (sort) => {
    setLocalSort(sort);
  };

  const handleClearAll = () => {
    const clearedFilters = { ...emptyFilters, priceRange: { ...emptyFilters.priceRange } };
    setLocalFilters(clearedFilters);
    setLocalCategory('all');
    setLocalRegion('all');
    setLocalSort('relevance');
    onApplyFilters(clearedFilters);
  };

  const handleApplyFilters = () => {
    onApplyFilters({
      ...localFilters,
      produceTypes: localCategory === 'all' ? [] : [localCategory],
      regions: localRegion === 'all' ? [] : [localRegion],
      sort: localSort
    });
  };

  return (
    <>
      {/* Desktop: horizontal filter bar that drops down under the search bar */}
      {isOpen && (
        <div
          id="listing-filters"
          className="hidden border-b border-border bg-surface shadow-warm lg:block"
        >
          <div className="flex flex-wrap items-end gap-4 px-6 py-4">
            {/* Category */}
            <div className="min-w-[11rem] flex-1">
              <label htmlFor="desktop-filter-category" className={desktopLabelClass}>
                {currentLanguage === 'am' ? 'የምርት አይነት' : 'Category'}
              </label>
              <select
                id="desktop-filter-category"
                value={localCategory}
                onChange={(e) => handleCategoryChange(e?.target?.value)}
                className={desktopControlClass}
              >
                {builtCategoryOptions?.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Region */}
            <div className="min-w-[11rem] flex-1">
              <label htmlFor="desktop-filter-region" className={desktopLabelClass}>
                {currentLanguage === 'am' ? 'አካባቢ' : 'Region'}
              </label>
              <select
                id="desktop-filter-region"
                value={localRegion}
                onChange={(e) => handleRegionChange(e?.target?.value)}
                className={desktopControlClass}
              >
                {builtRegionOptions?.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div className="min-w-[17rem] flex-1">
              <label className={desktopLabelClass}>
                {currentLanguage === 'am' ? 'የዋጋ ክልል (ብር)' : 'Price Range (ETB)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  aria-label={t?.minPrice}
                  value={localFilters?.priceRange?.min}
                  onChange={(e) => handlePriceChange('min', e?.target?.value)}
                  className={priceInputClass}
                />
                <span className="text-text-secondary">–</span>
                <input
                  type="number"
                  min="0"
                  placeholder="1000"
                  aria-label={t?.maxPrice}
                  value={localFilters?.priceRange?.max}
                  onChange={(e) => handlePriceChange('max', e?.target?.value)}
                  className={priceInputClass}
                />
              </div>
            </div>

            {/* Sort */}
            <div className="min-w-[11rem] flex-1">
              <label htmlFor="desktop-filter-sort" className={desktopLabelClass}>
                <span className="inline-flex items-center gap-1">
                  <Icon name="ArrowUpDown" size={14} />
                  {currentLanguage === 'am' ? 'ደርድር በ' : 'Sort'}
                </span>
              </label>
              <select
                id="desktop-filter-sort"
                value={localSort}
                onChange={(e) => handleSortChange(e?.target?.value)}
                className={desktopControlClass}
              >
                {sortOptions?.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Verification */}
            <div className="min-w-[11rem]">
              <label className={desktopLabelClass}>
                <span className="inline-flex items-center gap-1">
                  <Icon name="ShieldCheck" size={14} />
                  {t?.verification}
                </span>
              </label>
              <div className="flex h-10 items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleVerificationChange(!localFilters?.verifiedOnly)}
                  aria-pressed={!!localFilters?.verifiedOnly}
                  aria-label={t?.verified}
                  className={`w-10 h-6 rounded-full transition-colors ${localFilters?.verifiedOnly ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <span className={`block w-5 h-5 bg-white rounded-full transform transition-transform ${localFilters?.verifiedOnly ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
                <span className="text-xs text-text-secondary">{t?.verified}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="default" onClick={handleApplyFilters}>
                {t?.apply}
              </Button>
              <Button
                variant="ghost"
                onClick={handleClearAll}
                className="text-text-secondary hover:text-primary"
              >
                {t?.clearAll}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-80 max-w-[85vw] flex flex-col bg-surface border-r border-border shadow-warm-lg z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header with Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-text-primary">
            {currentLanguage === 'am' ? 'ማጣሪያዎች' : 'Filters'}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Icon name="X" size={20} />
          </Button>
        </div>

        {/* Filter Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Category Filter */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-secondary">
              {currentLanguage === 'am' ? 'የምርት አይነት' : 'Category'}
            </label>
            <div className="space-y-2">
              {builtCategoryOptions?.map(opt => (
                <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    checked={localCategory === opt.id}
                    onChange={() => handleCategoryChange(opt.id)}
                    className="w-4 h-4 text-primary border-border focus:ring-primary"
                  />
                  <span className="text-sm text-text-primary">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Region Filter */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-secondary">
              {currentLanguage === 'am' ? 'አካባቢ' : 'Region'}
            </label>
            <div className="space-y-2">
              {builtRegionOptions?.map(opt => (
                <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="region"
                    checked={localRegion === opt.id}
                    onChange={() => handleRegionChange(opt.id)}
                    className="w-4 h-4 text-primary border-border focus:ring-primary"
                  />
                  <span className="text-sm text-text-primary">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-secondary">
              {currentLanguage === 'am' ? 'የዋጋ ክልል' : 'Price Range (ETB)'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">{t?.minPrice}</label>
                <input
                  type="number"
                  placeholder="0"
                  value={localFilters?.priceRange?.min}
                  onChange={(e) => handlePriceChange('min', e?.target?.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm text-text-primary tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">{t?.maxPrice}</label>
                <input
                  type="number"
                  placeholder="1000"
                  value={localFilters?.priceRange?.max}
                  onChange={(e) => handlePriceChange('max', e?.target?.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm text-text-primary tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Sort */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-secondary">
              {currentLanguage === 'am' ? 'ደርድር በ' : 'Sort'}
            </label>
            <select
              value={localSort}
              onChange={(e) => handleSortChange(e?.target?.value)}
              className="w-full h-10 px-4 border border-border rounded-full text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {sortOptions?.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Verification */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <Icon name="ShieldCheck" size={14} /> {t?.verification}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">{t?.verified}</span>
              <button
                onClick={() => handleVerificationChange(!localFilters?.verifiedOnly)}
                className={`w-10 h-6 rounded-full transition-colors ${localFilters?.verifiedOnly ? 'bg-emerald-500' : 'bg-gray-300'}`}
                aria-label="Toggle verified"
              >
                <span className={`block w-5 h-5 bg-white rounded-full transform transition-transform ${localFilters?.verifiedOnly ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

        </div>

        {/* Mobile Footer */}
        <div className="sticky bottom-0 bg-surface border-t border-border p-4 space-y-2">
          <Button variant="default" className="w-full" onClick={() => { handleApplyFilters(); onClose(); }}>
            {currentLanguage === 'am' ? 'ማጣሪያዎችን ተግብር' : 'Apply Filters'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => { handleClearAll(); onClose(); }}>
            {currentLanguage === 'am' ? 'ሁሉንም አጽዳ' : 'Clear All'}
          </Button>
        </div>
      </div>
    </>
  );
};

export default FilterPanel;
