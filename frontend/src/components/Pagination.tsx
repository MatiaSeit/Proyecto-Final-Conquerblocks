interface Props {
  page: number;
  pageSize: number;
  count: number;
  onPageChange: (page: number) => void;
}

/** Page-number pagination matching DRF's PageNumberPagination (?page=N,
 * PAGE_SIZE=20 in settings/base.py) -- keeps the frontend's "load everything"
 * assumption from silently dropping rows past the first page once a table
 * grows past 20. */
export function Pagination({ page, pageSize, count, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button className="btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        &larr; Prev
      </button>
      <span className="muted">
        Page {page} of {totalPages} &middot; {count} total
      </span>
      <button className="btn" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Next &rarr;
      </button>
    </div>
  );
}
