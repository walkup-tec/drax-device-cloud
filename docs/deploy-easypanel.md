# Deploy EasyPanel — DRAX Device Cloud

## Estado atual (diagnóstico)

| Check | Resultado |
|-------|-----------|
| DNS `devices` | ainda pode ter **2 A**: `72.60.51.127` + `151.106.103.41` |
| Traefik router | **não existe** |
| Serviço Device Cloud | **não existe** |
| HTTPS local | 502 / cert self-signed (esperado sem app) |

Enquanto o A `151.106.103.41` existir, remova-o no painel DNS. Deixe só `72.60.51.127`.

## Domínios (2 registros A)

| Host | Aponta para | Serviço EasyPanel |
|------|-------------|-------------------|
| `devices.draxsistemas.com.br` | `72.60.51.127` | **web** |
| `api-devices.draxsistemas.com.br` | `72.60.51.127` | **api** |

## Pré-requisito GitHub

O código precisa estar num repo Git (EasyPanel builda pelo Git):

```bash
# na máquina local, pasta drax-device-cloud
gh auth login
gh repo create walkup-tec/drax-device-cloud --private --source=. --remote=origin --push
```

## EasyPanel — API

1. Projeto (ex.: `drax` ou `waba`) → **+ Service** → App
2. Nome: `device-cloud-api`
3. Source: Git `walkup-tec/drax-device-cloud` branch `main`
4. Dockerfile path: `infra/docker/Dockerfile.api`
5. Port: **4050**
6. Domínio: `api-devices.draxsistemas.com.br` (HTTPS)
7. Env:

```env
NODE_ENV=production
API_PORT=4050
REDROID_MODE=simulate
DEVICE_CLOUD_SSO_SECRET=72b928b67eb819bed95131d61485125c88b293569f808da84db8490e634586fa
JWT_ACCESS_SECRET=troque-por-segredo-longo-access
JWT_REFRESH_SECRET=troque-por-segredo-longo-refresh
DEFAULT_TENANT_ID=00000000-0000-4000-8000-000000000001
DEFAULT_OWNER_EMAIL=mozart.pmo@gmail.com
```

Não precisa de `DATABASE_URL` no MVP (usa memória).

## EasyPanel — Web

1. **+ Service** → App `device-cloud-web`
2. Mesmo Git/branch
3. Dockerfile path: `infra/docker/Dockerfile.web`
4. Build arg: `NEXT_PUBLIC_API_URL=https://api-devices.draxsistemas.com.br`
5. Port: **4051**
6. Domínio: `devices.draxsistemas.com.br`
7. Env:

```env
NODE_ENV=production
PORT=4051
HOSTNAME=0.0.0.0
```

## WABA (`waba_disparador`) — já quase ok

```env
DEVICE_CLOUD_PUBLIC_URL=https://devices.draxsistemas.com.br
DEVICE_CLOUD_SSO_SECRET=72b928b67eb819bed95131d61485125c88b293569f808da84db8490e634586fa
DEVICE_CLOUD_DEFAULT_TENANT_ID=00000000-0000-4000-8000-000000000001
DEVICE_CLOUD_DEFAULT_USER_ID=00000000-0000-4000-8000-000000000011
```

Remova a linha duplicada de `DEVICE_CLOUD_PUBLIC_URL`. Redeploy WABA se ainda não reiniciou após colar as envs.

## Validação SSH (depois do deploy)

```bash
dig +short devices.draxsistemas.com.br A
dig +short api-devices.draxsistemas.com.br A
grep -n "devices.draxsistemas\|api-devices.draxsistemas" /etc/easypanel/traefik/config/main.yaml || true
curl -sS -o /dev/null -w "web: %{http_code}\n" https://devices.draxsistemas.com.br/
curl -sS -o /dev/null -w "api-health: %{http_code}\n" https://api-devices.draxsistemas.com.br/health
```

Esperado: um único A por host (`72.60.51.127`), routers no Traefik, HTTP 200, cert Let's Encrypt (não self-signed).

## Fluxo no WABA

1. Login mozart → Dispositivos  
2. **Abrir Device Cloud** → iframe carrega o dashboard  
3. MVP com `REDROID_MODE=simulate` (sem KVM/Redroid ainda)
