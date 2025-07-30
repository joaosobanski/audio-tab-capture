# Audio Tab Capture

Sistema completo para captura de áudio de abas do navegador Chrome e transmissão em tempo real para um servidor backend.

## Funcionalidades

- 🎵 **Captura de Áudio**: Capture áudio de abas específicas do Chrome
- 📡 **Streaming em Tempo Real**: Transmissão via WebSocket 
- 🖥️ **Dashboard Web**: Interface para monitorar e controlar sessões
- 🔧 **Extensão Chrome**: Popup intuitivo para gerenciar capturas
- 📊 **Multi-sessões**: Suporte para múltiplas capturas simultâneas

## Estrutura do Projeto

```
packages/
├── shared/          # Tipos e utilitários compartilhados
├── backend/         # Servidor Node.js + WebSocket
├── extension/       # Extensão Chrome (Manifest V3)
└── web/            # Interface web do dashboard
```

## Configuração de Desenvolvimento

### Pré-requisitos

- Node.js >= 18.0.0
- npm >= 9.0.0
- Chrome/Chromium para testar a extensão

### Instalação

```bash
# Instalar dependências
npm install

# Build dos pacotes
npm run build
```

### Executar em Desenvolvimento

```bash
# Terminal 1: Iniciar backend
npm run backend:dev

# Terminal 2: Iniciar web interface
npm run web:dev

# Build da extensão
npm run extension:build
```

### Instalar Extensão Chrome

1. Abra Chrome e vá para `chrome://extensions/`
2. Ative o "Modo do desenvolvedor"
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `packages/extension/dist`

## Como Usar

1. **Iniciar o Backend**: Execute `npm run backend:dev`
2. **Abrir Dashboard**: Acesse `http://localhost:3000`
3. **Instalar Extensão**: Siga as instruções acima
4. **Capturar Áudio**: 
   - Abra uma aba com áudio
   - Clique na extensão
   - Selecione a aba para capturar
   - Monitore no dashboard

## Tecnologias

- **Backend**: Node.js, Express, WebSocket (ws)
- **Extensão**: TypeScript, Chrome Extension APIs (Manifest V3)
- **Web**: HTML5, TypeScript, WebSocket API
- **Build**: Vite, TypeScript
- **Workspace**: npm workspaces

## API Endpoints

- `GET /api/sessions` - Lista sessões ativas
- `GET /api/health` - Status do servidor
- `GET /api/stats` - Estatísticas do servidor
- `WebSocket ws://localhost:8080` - Streaming de áudio

## Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## Licença

MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.
