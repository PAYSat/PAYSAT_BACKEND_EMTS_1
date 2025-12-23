import {coinGeckoBaseUrl} from '../config/crypto_coingecko.js';

export async function cryptoCurrenciesList(req, res) {
  try {
    // Obtener parámetros desde query params
    const perPage = req.query.perPage || 10;
    const page = req.query.page || 1;

    // Construir la URL con los parámetros
    const url = `${coinGeckoBaseUrl}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        ok: false, 
        message: 'Error al obtener lista de criptomonedas' 
      });
    }
    
    const data = await response.json();
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('❌ Error fetching crypto currencies list:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export async function cryptoCurrencyById(req, res) {
  try {
    // Validar que el usuario esté autenticado
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ ok: false, message: 'No autorizado' });
    }

    const { id } = req.params;
    const response = await fetch(`${coinGeckoBaseUrl}/coins/${id}`);
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, message: 'Cryptocurrency not found' });
    }
    const data = await response.json();
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('❌ Error fetching crypto currency by ID:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}