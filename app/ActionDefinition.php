<?php

namespace MissionTerminal;

final class ActionDefinition
{
    public function __construct(
        public string $key,
        public string $group,
        public string $label,
        public string $description,
        public string $method,
        public string $endpoint,
        public string $sdkMethod,
        public array $defaultPayload = [],
        public array $requiredFields = [],
        public bool $needsPaymentId = false,
        public bool $needsCardId = false,
        public bool $danger = false,
    ) {}
}
