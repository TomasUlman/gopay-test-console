<?php

namespace MissionTerminal;

use GoPay\Api;
use GoPay\Definition\Language;
use GoPay\Definition\TokenScope;

final class GoPayClientFactory
{
    public static function make(array $cfg): object
    {
        return Api::payments([
            'goid' => $cfg['goid'],
            'clientId' => $cfg['clientId'],
            'clientSecret' => $cfg['clientSecret'],
            'gatewayUrl' => $cfg['gatewayUrl'],
            'scope' => TokenScope::ALL,
            'language' => strtoupper($cfg['lang'] ?? 'CS') === 'CS' ? Language::CZECH : Language::ENGLISH,
            'timeout' => 30,
        ]);
    }
}
