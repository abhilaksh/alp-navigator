'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface ClientOption {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface ClientSelection {
  clientId?: number;
  clientName?: string;
}

interface ClientPickerProps {
  id?: string;
  label?: string;
  optional?: boolean;
  placeholder?: string;
  onChange: (selection: ClientSelection) => void;
}

export function ClientPicker({
  id = 'clientQuery',
  label = 'Client',
  optional = true,
  placeholder = 'Search existing clients or type a new name',
  onChange,
}: ClientPickerProps) {
  const [clientQuery, setClientQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/clients')
      .then(res => (res.ok ? res.json() : []))
      .then((data: ClientOption[]) => setClients(Array.isArray(data) ? data : []))
      .catch(() => setClients([]))
      .finally(() => setClientsLoaded(true));
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filteredClients = clientQuery.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(clientQuery.trim().toLowerCase()))
    : clients;

  function pickClient(c: ClientOption) {
    setSelectedClient(c);
    setClientQuery(c.name);
    setDropdownOpen(false);
    onChange({ clientId: c.id });
  }

  function clearSelection() {
    setSelectedClient(null);
    setClientQuery('');
    setDropdownOpen(true);
    onChange({});
  }

  function handleQueryChange(value: string) {
    setClientQuery(value);
    setSelectedClient(null);
    setDropdownOpen(true);
    onChange({ clientName: value.trim() || undefined });
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-sm font-medium text-ink-soft mb-1.5">
        {label}
        {optional && <span className="ml-1.5 text-ink-mute font-normal">(optional)</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={clientQuery}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setDropdownOpen(true)}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 pr-9 bg-white border border-glacier rounded-md text-sm text-ink placeholder:text-ink-mute/60 focus:outline-none focus:ring-1 focus:ring-brass focus:border-brass transition-colors"
        />
        {selectedClient ? (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink-soft"
            aria-label="Clear selected client"
          >
            <Check size={16} className="text-spruce" />
          </button>
        ) : (
          <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
        )}
      </div>

      {dropdownOpen && clientsLoaded && !selectedClient && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-glacier rounded-md shadow-md max-h-56 overflow-y-auto">
          {filteredClients.length > 0 ? (
            filteredClients.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickClient(c)}
                className="w-full text-left px-3.5 py-2 text-sm hover:bg-paper-deep transition-colors flex flex-col"
              >
                <span className="text-ink">{c.name}</span>
                {(c.email || c.phone) && (
                  <span className="text-xs text-ink-mute">{c.email || c.phone}</span>
                )}
              </button>
            ))
          ) : clientQuery.trim() ? (
            <div className="px-3.5 py-2.5 text-sm text-ink-mute">
              No match — <span className="text-ink">&ldquo;{clientQuery.trim()}&rdquo;</span> will be created as a new client
            </div>
          ) : (
            <div className="px-3.5 py-2.5 text-sm text-ink-mute">No clients yet — type a name to create one</div>
          )}
        </div>
      )}
    </div>
  );
}
