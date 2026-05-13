<?php
$dir = dirname(__DIR__) . '/storage/history';
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}
$entry = [
    'time' => date('c'),
    'query' => $_GET,
    'body' => file_get_contents('php://input'),
    'headers' => function_exists('getallheaders') ? getallheaders() : [],
];
file_put_contents($dir . '/callbacks.log', json_encode($entry, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL . PHP_EOL, FILE_APPEND);
http_response_code(200);
echo 'OK';
