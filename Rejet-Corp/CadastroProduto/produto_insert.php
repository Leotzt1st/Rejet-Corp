<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['message' => 'Method not allowed']);
  exit;
}

// Coloque esses valores em variáveis de ambiente seguras, não em código fonte em produção.
define('SUPABASE_URL', 'https://SEU_PROJETO_ID.supabase.co');
define('SUPABASE_SERVICE_ROLE_KEY', 'SUA_SERVICE_ROLE_KEY');

$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
if (!$authHeader || !preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
  http_response_code(401);
  echo json_encode(['message' => 'Authorization Bearer token required']);
  exit;
}

$userToken = $matches[1];

// Valida o usuário JWT via endpoint /auth/v1/user
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, SUPABASE_URL . '/auth/v1/user');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Authorization: Bearer ' . $userToken,
  'apikey: ' . SUPABASE_SERVICE_ROLE_KEY,
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$info = curl_getinfo($ch);
curl_close($ch);

if ($info['http_code'] !== 200) {
  http_response_code(401);
  echo json_encode(['message' => 'Usuário não autenticado', 'supabase_response' => $response]);
  exit;
}

$userData = json_decode($response, true);
if (!$userData || empty($userData['id'])) {
  http_response_code(401);
  echo json_encode(['message' => 'Falha na verificação do usuário']);
  exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!$payload) {
  http_response_code(400);
  echo json_encode(['message' => 'Payload inválido']);
  exit;
}

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

$insertData = [
  'product' => $product,
  'description' => $description,
  'quantities' => $quantities,
  'cep' => $cep,
  'locationc' => $locationc,
  'price' => $price,
  'image_name' => $image_name,
  'created_by' => $userData['id'],
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, SUPABASE_URL . '/rest/v1/produtos');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'apikey: ' . SUPABASE_SERVICE_ROLE_KEY,
  'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type: application/json',
  'Prefer: return=representation',
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($insertData));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$info = curl_getinfo($ch);
curl_close($ch);

if ($info['http_code'] >= 400) {
  http_response_code($info['http_code']);
  echo json_encode(['message' => 'Erro ao inserir produto', 'detail' => json_decode($response, true)]);
  exit;
}

echo $response;
