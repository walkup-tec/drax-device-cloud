# WhatsApp Business em celular virtual (Redroid)

## Objetivo

Ter um **Android real** (não só o card simulate), instalar **WhatsApp Business** e vincular um número via QR.

## Pré-requisitos (obrigatórios)

1. Host Linux com **KVM** (`/dev/kvm` existe).
2. API Device Cloud com:
   - `REDROID_MODE=docker`
   - volume `/var/run/docker.sock`
   - device `/dev/kvm` (ou API rodando no host com docker)
   - `ADB_CONNECT_HOST=172.17.0.1` (padrão se API estiver em container)
3. Variável com APK legal do WhatsApp Business:
   - `WHATSAPP_BUSINESS_APK_URL=https://...` (URL direta do `.apk` que você hospeda/baixa legalmente)

## Checagem KVM (SSH no VPS)

```bash
ls -l /dev/kvm || echo "SEM KVM"
egrep -c '(vmx|svm)' /proc/cpuinfo
docker run --rm --privileged --device /dev/kvm redroid/redroid:12.0.0-latest true 2>&1 | head
```

Se **SEM KVM**, este VPS não roda Redroid. Use outro servidor com virtualização habilitada na Hostinger/provedor.

## EasyPanel — API

Além das envs atuais, adicione:

```env
REDROID_MODE=docker
ADB_CONNECT_HOST=172.17.0.1
WHATSAPP_BUSINESS_APK_URL=
```

Mounts (se o painel permitir volumes/devices):

- `/var/run/docker.sock:/var/run/docker.sock`
- `/dev/kvm:/dev/kvm`

Redeploy a API após o build com Dockerfile que inclui `adb` + `docker-cli`.

## Fluxo no dashboard

1. **Criar celular virtual** (com `REDROID_MODE=docker` o create sobe um container Redroid).
2. **Instalar WA Business** (baixa APK da URL e `adb install`).
3. **Ver tela (QR)** — screenshot a cada ~2,5s.
4. No celular físico: WhatsApp → Aparelhos conectados / QR → escanear a tela virtual.
5. Concluir verificação SMS/chamada no próprio WhatsApp Business.

## Limitações honestas

- WhatsApp pode **detectar emulador** e limitar/banir contas — use com responsabilidade.
- `simulate` **não** instala WA (não há Android).
- Streaming fluido (WebRTC) ainda não; MVP usa screenshot.
- Não redistribuímos o APK do WhatsApp no repositório.

## Validação

```bash
curl -sS https://api-devices.draxsistemas.com.br/health
# marker deve citar wa-apk após deploy
```

No UI: device ONLINE real → instalar → ver QR na painel direito.
