const clsx = (...values) =>
  values
    .flat()
    .filter(Boolean)
    .join(' ');

export default clsx;
