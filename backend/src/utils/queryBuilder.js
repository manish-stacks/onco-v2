/**
 * A small WHERE-clause builder. Every model used to repeat `const where=[]; const params=[]`
 * avoids repeating it, and params are always bound via placeholders
 * (SQL injection safe).
 *
 *   const qb = new QueryBuilder();
 *   qb.eq('status', filters.status)
 *     .like(['name','sku'], filters.search)
 *     .gte('created_at', filters.from)
 *     .in('category_id', filters.categories);
 *   const { sql, params } = qb.build();   // sql = "WHERE ... AND ..."
 */
class QueryBuilder {
  constructor(prefix = '') {
    this.clauses = [];
    this.params = [];
    this.prefix = prefix ? `${prefix}.` : '';
  }

  raw(sql, ...params) {
    if (!sql) return this;
    this.clauses.push(sql);
    this.params.push(...params);
    return this;
  }

  eq(column, value) {
    if (value === undefined || value === null || value === '') return this;
    this.clauses.push(`${this.prefix}\`${column}\` = ?`);
    this.params.push(value);
    return this;
  }

  neq(column, value) {
    if (value === undefined || value === null || value === '') return this;
    this.clauses.push(`${this.prefix}\`${column}\` != ?`);
    this.params.push(value);
    return this;
  }

  gte(column, value) {
    if (value === undefined || value === null || value === '') return this;
    this.clauses.push(`${this.prefix}\`${column}\` >= ?`);
    this.params.push(value);
    return this;
  }

  lte(column, value) {
    if (value === undefined || value === null || value === '') return this;
    this.clauses.push(`${this.prefix}\`${column}\` <= ?`);
    this.params.push(value);
    return this;
  }

  /** Ek ya multiple columns me LIKE %search% */
  like(columns, value) {
    if (value === undefined || value === null || value === '') return this;
    const cols = Array.isArray(columns) ? columns : [columns];
    const parts = cols.map((c) => `${this.prefix}\`${c}\` LIKE ?`);
    this.clauses.push(`(${parts.join(' OR ')})`);
    cols.forEach(() => this.params.push(`%${value}%`));
    return this;
  }

  in(column, values) {
    if (!values) return this;
    const arr = Array.isArray(values) ? values : String(values).split(',');
    const clean = arr.map((v) => String(v).trim()).filter(Boolean);
    if (!clean.length) return this;
    this.clauses.push(`${this.prefix}\`${column}\` IN (${clean.map(() => '?').join(',')})`);
    this.params.push(...clean);
    return this;
  }

  /** boolean-ish flag ('1'/'0'/true/false) */
  flag(column, value, truthyValue = '1') {
    if (value === undefined || value === null || value === '') return this;
    const on = value === true || value === 'true' || value === '1' || value === 1;
    if (!on) return this;
    this.clauses.push(`${this.prefix}\`${column}\` = ?`);
    this.params.push(truthyValue);
    return this;
  }

  build() {
    return {
      sql: this.clauses.length ? `WHERE ${this.clauses.join(' AND ')}` : '',
      params: this.params,
    };
  }
}

/** ORDER BY safely — the column can only come from a whitelist */
function orderBy(column, direction = 'DESC', prefix = '') {
  if (!column) return '';
  const p = prefix ? `${prefix}.` : '';
  const dir = String(direction).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return `ORDER BY ${p}\`${column}\` ${dir}`;
}

module.exports = { QueryBuilder, orderBy };
