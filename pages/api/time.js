export default function handler(req, res) {
  res.status(200).json({ serverTime: new Date().toISOString() })
}
