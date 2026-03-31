<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['message' => 'Method not allowed']);
  exit;
}

$SUPABASE_URL = getenv('SUPABASE_URL') ?: 'https://SEU_PROJETO_ID.supabase.co';
$SUPABASE_SERVICE_ROLE_KEY = getenv('SUPABASE_SERVICE_ROLE_KEY') ?: 'SUA_SERVICE_ROLE_KEY';

if (!$SUPABASE_URL || !$SUPABASE_SERVICE_ROLE_KEY || strpos($SUPABASE_URL, 'SEU_PROJETO_ID') !== false || $SUPABASE_SERVICE_ROLE_KEY === 'SUA_SERVICE_ROLE_KEY') {
  http_response_code(500);
  echo json_encode(['message' => 'Configuração de Supabase inválida.']);
  exit;
}

$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
if (!$authHeader || !preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
  http_response_code(401);
  echo json_encode(['message' => 'Authorization Bearer token required']);
  exit;
}

$userToken = $matches[1];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $SUPABASE_URL . '/auth/v1/user');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Authorization: Bearer ' . $userToken,
  'apikey: ' . $SUPABASE_SERVICE_ROLE_KEY,
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$info = curl_getinfo($ch);
curl_close($ch);

if ($info['http_code'] !== 200) {
  http_response_code(401);
  echo json_encode(['message' => 'Usuário não autenticado']);
  exit;
}

$query = $_GET['q'] ?? '';
$filter = '';
if ($query) {
  $escaped = urlencode($query);
  $filter = "?or=(product.ilike.%25$escaped%25,description.ilike.%25$escaped%25,cep.eq.$escaped,locationc.ilike.%25$escaped%25)";
}

$url = $SUPABASE_URL . '/rest/v1/produtos';
if ($filter) {
  $url .= $filter . '&select=*';
} else {
  $url .= '?select=*';
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'apikey: ' . $SUPABASE_SERVICE_ROLE_KEY,
  'Authorization: Bearer ' . $SUPABASE_SERVICE_ROLE_KEY,
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$info = curl_getinfo($ch);
curl_close($ch);

if ($info['http_code'] >= 400) {
  http_response_code($info['http_code']);
  echo json_encode(['message' => 'Erro ao buscar produtos']);
  exit;
}

$data = json_decode($response, true);
if (!is_array($data)) {
  echo json_encode([]);
  exit;
}

echo json_encode($data);
