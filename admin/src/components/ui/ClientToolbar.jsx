import { FilterBar, SearchInput, FilterSelect } from '@/components/ui/DataTable';

/** Search + status filter bar for lists driven by useClientList */
export function ClientToolbar({ list, placeholder = 'Search…' }) {
  return (
    <FilterBar hasFilters={list.hasFilters} onReset={list.reset}>
      <SearchInput value={list.search} onChange={list.setSearch} placeholder={placeholder} className="w-full sm:w-64" />
      {list.hasStatus && (
        <FilterSelect label="Status" value={list.status} placeholder="All"
          options={['active', 'inactive']} onChange={list.setStatus} />
      )}
    </FilterBar>
  );
}
