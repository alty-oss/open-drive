# Deploy do OpenDrive

Este guia descreve o deploy recomendado do OpenDrive em um único servidor com
Docker Compose. Nesse modelo, o processo Go, o frontend compilado, o SQLite e os
arquivos do usuário ficam na mesma máquina.

## 1. Pré-requisitos

- Um servidor Linux com Docker Engine e o plugin Docker Compose.
- Git instalado para obter e atualizar o código.
- Um domínio apontando para o servidor, caso o serviço seja publicado na
  internet.
- Espaço em disco suficiente para `STORAGE_QUOTA_BYTES`, os uploads temporários
  e os backups.

Confirme a instalação:

```bash
docker --version
docker compose version
git --version
```

## 2. Obter o projeto

```bash
git clone https://github.com/alty-oss/open-drive.git
cd open-drive
```

Para um ambiente previsível, prefira fazer deploy de uma tag ou commit conhecido
em vez de acompanhar automaticamente cada alteração da branch `main`.

## 3. Configurar o ambiente

Crie o arquivo local de configuração:

```bash
cp .env.example .env
```

Edite `.env` e, no mínimo, substitua estes valores:

```dotenv
LOGIN_USER=admin
LOGIN_PASS=use-uma-senha-longa-e-unica
SESSION_SECRET=use-um-segredo-aleatorio
```

Um segredo pode ser gerado com:

```bash
openssl rand -hex 32
```

As principais opções são:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `LOGIN_USER` | vazio | Usuário principal. |
| `LOGIN_PASS` | vazio | Senha do usuário principal. |
| `LOGIN_USER2` | vazio | Segundo usuário opcional. |
| `LOGIN_PASS2` | vazio | Senha do segundo usuário opcional. |
| `SESSION_SECRET` | `fallback-secret` | Assina as sessões; deve ser único e secreto em produção. |
| `PORT` | `3050` | Porta HTTP usada dentro do container. |
| `STORAGE_DIR` | `./storage` | Raiz dos arquivos no container. O Compose monta `./storage` em `/app/storage`. |
| `DB_PATH` | `STORAGE_DIR/.data/index.db` | Caminho do banco SQLite. |
| `MAX_UPLOAD_SIZE_BYTES` | 5 GiB | Tamanho máximo de um arquivo. |
| `STORAGE_QUOTA_BYTES` | 50 GiB | Cota total de armazenamento. |
| `MAX_UPLOAD_FILES` | `50` | Número máximo de arquivos por lote. |
| `WATCH_POLLING` | `false` | Use `true` se eventos de filesystem não atravessarem o volume. |

Não versione o arquivo `.env`. Ele já está ignorado pelo Git.

## 4. Iniciar a aplicação

Crie o diretório persistente e suba o serviço:

```bash
mkdir -p storage
docker compose up -d --build
```

O primeiro build compila o backend Go e o frontend React. Acompanhe a
inicialização com:

```bash
docker compose ps
docker compose logs -f open-drive
```

Valide o health check:

```bash
curl --fail http://127.0.0.1:3050/healthz
```

A resposta esperada é:

```json
{"status":"ok"}
```

Sem proxy reverso, a interface fica disponível em
`http://IP-DO-SERVIDOR:3050`.

## 5. Publicar com domínio e HTTPS

Não exponha uma instalação de produção diretamente por HTTP. Use um proxy
reverso com TLS e mantenha a porta `3050` acessível somente no próprio servidor.

Altere o mapeamento em `docker-compose.yml`:

```yaml
ports:
  - "127.0.0.1:3050:3050"
```

Um exemplo mínimo com Caddy instalado no host é:

```caddyfile
drive.example.com {
    reverse_proxy 127.0.0.1:3050
}
```

Depois de apontar o DNS para o servidor, recarregue o proxy e acesse
`https://drive.example.com`. O proxy deve preservar conexões WebSocket; o Caddy
faz isso automaticamente.

## 6. Atualizar

Antes de atualizar, faça backup de `storage/`. Em seguida:

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:3050/healthz
```

O Compose substitui o container e preserva o diretório `./storage` montado no
host. Consulte os logs se o health check não ficar saudável:

```bash
docker compose logs --tail=200 open-drive
```

## 7. Backup e restauração

O diretório `storage/` contém os arquivos, o índice SQLite, a lixeira e uploads
em andamento. Para produzir uma cópia consistente, pare a aplicação antes de
copiá-lo:

```bash
docker compose stop open-drive
tar -czf open-drive-storage-backup.tar.gz storage
docker compose start open-drive
```

Guarde o backup fora do servidor. O arquivo `.env` também deve ser salvo em um
cofre de segredos ou backup criptografado.

Para restaurar, pare o serviço, mova o diretório atual para um local seguro,
extraia o backup na raiz do projeto e inicie novamente:

```bash
docker compose stop open-drive
mv storage storage.before-restore
tar -xzf open-drive-storage-backup.tar.gz
docker compose start open-drive
```

Só remova `storage.before-restore` depois de validar os arquivos e o login.

## 8. Operação e diagnóstico

Comandos úteis:

```bash
docker compose ps
docker compose logs -f open-drive
docker compose restart open-drive
docker compose stop
docker compose start
```

Se alterações feitas diretamente em `storage/` não aparecerem na interface,
defina `WATCH_POLLING=true` e recrie o container:

```bash
docker compose up -d
```

O SQLite é adequado ao modelo atual de uma única instância. Não execute vários
containers do OpenDrive sobre o mesmo diretório `storage/`.

## Checklist de produção

- Credenciais e `SESSION_SECRET` foram substituídos.
- A aplicação está atrás de HTTPS.
- A porta `3050` não está aberta publicamente quando há proxy reverso.
- O diretório `storage/` está em disco persistente e com espaço monitorado.
- Existe backup externo testado de `storage/` e do `.env`.
- `docker compose ps` mostra o serviço como saudável.
