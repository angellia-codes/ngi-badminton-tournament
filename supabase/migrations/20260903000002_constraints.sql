-- One approved registration per (tournament, category, outlet).
-- Partial index, so multiple *pending* submissions from the same outlet and
-- category are allowed: the admin picks one explicitly rather than the system
-- silently accepting whoever submitted first.
create unique index one_approved_slot_per_outlet_category
on registrations (tournament_id, category_id, outlet_id)
where status = 'approved';
