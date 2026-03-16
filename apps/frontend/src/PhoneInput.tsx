import { useState, useRef, useEffect } from 'react';

const COUNTRIES = [
  { code: '+54', iso: 'ar', name: 'Argentina' },
  { code: '+591', iso: 'bo', name: 'Bolivia' },
  { code: '+55', iso: 'br', name: 'Brasil' },
  { code: '+56', iso: 'cl', name: 'Chile' },
  { code: '+57', iso: 'co', name: 'Colombia' },
  { code: '+506', iso: 'cr', name: 'Costa Rica' },
  { code: '+593', iso: 'ec', name: 'Ecuador' },
  { code: '+503', iso: 'sv', name: 'El Salvador' },
  { code: '+34', iso: 'es', name: 'España' },
  { code: '+1', iso: 'us', name: 'Estados Unidos' },
  { code: '+502', iso: 'gt', name: 'Guatemala' },
  { code: '+504', iso: 'hn', name: 'Honduras' },
  { code: '+52', iso: 'mx', name: 'Mexico' },
  { code: '+505', iso: 'ni', name: 'Nicaragua' },
  { code: '+507', iso: 'pa', name: 'Panamá' },
  { code: '+595', iso: 'py', name: 'Paraguay' },
  { code: '+51', iso: 'pe', name: 'Perú' },
  { code: '+1', iso: 'pr', name: 'Puerto Rico' },
  { code: '+1', iso: 'do', name: 'República Dominicana' },
  { code: '+598', iso: 'uy', name: 'Uruguay' },
  { code: '+58', iso: 've', name: 'Venezuela' },
];

interface Props {
  value: string;
  onChange: (fullNumber: string) => void;
  placeholder?: string;
  required?: boolean;
}

function Flag({ iso, className }: { iso: string; className?: string }) {
  return <span className={`fi fi-${iso} ${className || ''}`} />;
}

export default function PhoneInput({ value, onChange, placeholder, required }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(() => {
    const regionCode = navigator.language?.split('-')[1]?.toLowerCase();
    return (regionCode && COUNTRIES.find((c) => c.iso === regionCode)) || COUNTRIES.find((c) => c.iso === 'pe')!;
  });
  const [localNumber, setLocalNumber] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync local number from value prop on mount
  useEffect(() => {
    if (value && !localNumber) {
      const country = COUNTRIES.find((c) => value.startsWith(c.code));
      if (country) {
        setSelectedCountry(country);
        setLocalNumber(value.slice(country.code.length).trim());
      } else {
        setLocalNumber(value);
      }
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (country: typeof COUNTRIES[0]) => {
    setSelectedCountry(country);
    setOpen(false);
    setSearch('');
    onChange(`${country.code} ${localNumber}`);
  };

  const handleNumberChange = (num: string) => {
    setLocalNumber(num);
    onChange(`${selectedCountry.code} ${num}`);
  };

  const filtered = search
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.includes(search)
      )
    : COUNTRIES;

  return (
    <div className="relative flex" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2.5 border border-r-0 border-slate-300 rounded-l-lg bg-slate-50 hover:bg-slate-100 transition text-sm shrink-0"
      >
        <Flag iso={selectedCountry.iso} className="text-lg" />
        <span className="text-slate-600 font-medium">{selectedCountry.code}</span>
        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <input
        type="tel"
        value={localNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        className="w-full px-4 py-2.5 border border-slate-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        placeholder={placeholder || '300 123 4567'}
        required={required}
      />

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-[2100] max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Buscar pais..."
              autoFocus
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.map((country, i) => (
              <button
                key={`${country.iso}-${i}`}
                type="button"
                onClick={() => handleSelect(country)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-green-50 transition text-left ${
                  selectedCountry.name === country.name ? 'bg-green-50 text-green-700' : 'text-slate-700'
                }`}
              >
                <Flag iso={country.iso} className="text-lg" />
                <span className="flex-1">{country.name}</span>
                <span className="text-slate-400 text-xs">{country.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
