import { useEffect, useState } from 'react';
import { store } from '../store/index.js';

export function useLiveCollection(name, orderField) {
  const [docs, setDocs] = useState([]);
  useEffect(() => store.subscribeCollection(name, orderField, setDocs), [name, orderField]);
  return docs;
}
