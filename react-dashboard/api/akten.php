<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Alle Akten laden
    $stmt = $pdo->query("SELECT * FROM akten ORDER BY erstellt_am DESC");
    $akten = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($akten);
} 

elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Neue Akte erstellen
    $input = json_decode(file_get_contents('php://input'), true);
    
    $stmt = $pdo->prepare("INSERT INTO akten (kunde, kennzeichen, schadenort, status, erstellt_am) VALUES (?, ?, ?, ?, NOW())");
    $stmt->execute([
        $input['kunde'],
        $input['kennzeichen'], 
        $input['schadenort'],
        $input['status'] ?? 'Entwurf'
    ]);
    
    echo json_encode(['id' => $pdo->lastInsertId(), 'success' => true]);
}
?>