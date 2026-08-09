// FastAPI sends errors in two different shapes:
//   - HTTPException(detail="some string")            -> detail is a string
//   - Pydantic validation errors (422)                -> detail is an array of
//     objects like { type, loc, msg, input, ctx }
// Rendering the array directly in a <Text> crashes React Native, so always
// pass errors through this helper before displaying them.
export function getErrorMessage(err, fallback = 'Something went wrong') {
  const detail = err?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
  }
  if (typeof detail === 'string') {
    return detail;
  }
  return err?.message || fallback;
}