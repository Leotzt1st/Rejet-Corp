<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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

$userData = json_decode($response, true);
if (!$userData || empty($userData['id'])) {
  http_response_code(401);
  echo json_encode(['message' => 'Falha na verificação do usuário']);
  exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!$payload || empty($payload['id'])) {
  http_response_code(400);
  echo json_encode(['message' => 'Payload inválido ou ID ausente']);
  exit;
}

$id = $payload['id'];
$product = trim($payload['product'] ?? '');
$description = trim($payload['description'] ?? '');
$quantities = trim($payload['quantities'] ?? '');
$locationc = trim($payload['locationc'] ?? '');
$cep = trim($payload['cep'] ?? '');
$price = trim($payload['price'] ?? '');
$image_name = trim($payload['image_name'] ?? '');

if (empty($product)) {
  http_response_code(400);
  echo json_encode(['message' => 'Produto é obrigatório']);
  exit;
}

if ($quantities === '' || !is_numeric($quantities) || floatval($quantities) <= 0) {
  http_response_code(400);
  echo json_encode(['message' => 'Quantidade deve ser numérica e maior que zero']);
  exit;
}

if ($price === '' || !is_numeric($price) || floatval($price) <= 0) {
  http_response_code(400);
  echo json_encode(['message' => 'Preço deve ser numérico e maior que zero']);
  exit;
}

if ($cep === '' || !preg_match('/^\d{5}-?\d{3}$/', $cep)) {
  http_response_code(400);
  echo json_encode(['message' => 'CEP inválido']);
  exit;
}

$quantities = floatval($quantities);
$price = floatval($price);
$cep = preg_replace('/\D/', '', $cep);

// valida propriedade do produto
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $SUPABASE_URL . '/rest/v1/produtos?id=eq.' . urlencode($id) . '&select=created_by');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'apikey: ' . $SUPABASE_SERVICE_ROLE_KEY,
  'Authorization: Bearer ' . $SUPABASE_SERVICE_ROLE_KEY,
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$prodResponse = curl_exec($ch);
$prodInfo = curl_getinfo($ch);
curl_close($ch);

if ($prodInfo['http_code'] >= 400) {
  http_response_code($prodInfo['http_code']);
  echo json_encode(['message' => 'Erro ao ler produto']);
  exit;
}

$prodData = json_decode($prodResponse, true);
if (empty($prodData[0]) || $prodData[0]['created_by'] !== $userData['id']) {
  http_response_code(403);
  echo json_encode(['message' => 'Operação não autorizada']);
  exit;
}

$updateData = [
  'product' => $product,
  'description' => $description,
  'quantities' => $quantities,
  'cep' => $cep,
  'locationc' => $locationc,
  'price' => $price,
  'image_name' => $image_name,
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $SUPABASE_URL . '/rest/v1/produtos?id=eq.' . urlencode($id));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'apikey: ' . $SUPABASE_SERVICE_ROLE_KEY,
  'Authorization: Bearer ' . $SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type: application/json',
]);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($updateData));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$info = curl_getinfo($ch);
curl_close($ch);

if ($info['http_code'] >= 400) {
  http_response_code($info['http_code']);
  echo json_encode(['message' => 'Erro ao atualizar produto']);
  exit;
}

echo json_encode(['message' => 'Produto atualizado com sucesso']);
