# AIagent

**AIagent**는 자연어 지시를 바탕으로 다양한 컴퓨터 작업을 자동화해주는 도구입니다. Windows와 macOS 환경에서 모두 동작하며, Docker를 활용해 확장된 방식으로 사용할 수도 있습니다.

---

## 핵심 기능

- **직관적인 컴퓨터 제어**  
  일상 언어로 "영상 편집 부탁해" 또는 "문서 정리해줘"와 같이 지시하면, AI가 해당 작업을 대신 실행합니다.

- **광범위한 업무 자동화**  
  파일 관리, 이미지 편집, 문서 작성 등 복잡하고 번거로운 작업을 AI가 수행해줍니다.

- **다중 운영체제 지원**  
  Windows와 macOS 환경에서 모두 동작하므로 원하는 시스템에서 자유롭게 활용 가능합니다.

- **실시간 상태 모니터링**  
  AI가 진행 중인 작업이 무엇인지 한눈에 확인할 수 있는 직관적인 인터페이스를 제공합니다.

---

## 필요 환경

- **Node.js** (최신 LTS 버전 권장)
- **Docker** (선택사항이지만 권장)
- **운영체제**: Windows 또는 macOS

---

## 설치 및 준비

### 1. Node.js 설치
- [Node.js 공식 웹사이트](https://nodejs.org/)에서 최신 LTS 버전을 다운로드하여 설치합니다.

### 2. Docker 설치
- [Docker Desktop](https://www.docker.com/)에서 최신 버전을 다운로드하여 시스템에 설치합니다.

### 3. Docker 이미지 빌드

#### macOS
```bash
git clone https://github.com/m-ill/aiagent.git && cd aiagent/my-docker-app
docker build --platform linux/x86_64 -t my-node-ubuntu .
```

#### Windows
1. 윈도우 검색창에서 "PowerShell"을 검색하고, **관리자 권한**으로 실행합니다.  
2. 아래 명령어들을 순서대로 입력하세요:
   ```powershell
   # 실행 정책 변경
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

   # 디렉토리 생성
   New-Item -ItemType Directory -Path "my-docker-app" -Force

   # 작업 디렉토리 이동
   cd my-docker-app

   # Dockerfile 다운로드
   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/m-ill/aiagent/main/my-docker-app/Dockerfile" -OutFile "Dockerfile"

   # Docker 이미지 빌드
   docker build --platform linux/x86_64 -t my-node-ubuntu .

   # End
   ```

### 4. aiagent 설치

#### Windows
1. 윈도우 검색창에서 "PowerShell"을 실행합니다.
2. 아래 명령어를 복사해 붙여넣고 Enter 키를 누릅니다:
   ```powershell
   npm install -g https://github.com/m-ill/aiagent.git
   ```

#### macOS
1. Spotlight(⌘ + Space)에서 "터미널"을 검색해 실행합니다.
2. 터미널 창이 열리면 다음 명령어를 실행합니다:
   ```bash
   sudo npm install -g https://github.com/m-ill/aiagent.git
   ```
3. 관리자 비밀번호를 묻는 메시지가 나타나면 본인의 Mac 로그인 암호를 입력합니다.

---

## 환경 설정

**AIagent**는 Anthropic의 Claude 모델을 사용합니다.

### 1. API 키 발급
1. [Claude API Console](https://console.anthropic.com/settings/keys)에 접속하여 계정 생성 후 로그인합니다.
2. [결제 설정 페이지](https://console.anthropic.com/settings/billing)에서 신용카드 정보를 등록하고 결제 설정을 진행합니다.
3. API 키를 발급받습니다.

### 2. 설정 명령어

```bash
# Claude API 키 등록
aiagent config claudeApiKey "sk-ant-api..."

# AI 모델 설정 (예시)
aiagent config model "claude-3-5-haiku-20241022"  # 빠르고 경제적인 모델
# 또는
aiagent config model "claude-3-5-sonnet-20241022" # 보다 정교한 작업 처리

# 반복 횟수 및 출력 디렉토리 옵션
aiagent config maxIterations 0                  # 0=무제한 반복
aiagent config overwriteOutputDir false         # 출력 디렉토리 덮어쓰기 여부

# Docker 설정 (선택사항)
aiagent config useDocker true                   # Docker 사용 여부
aiagent config dockerImage "my-node-ubuntu"     # Docker 이미지 이름
aiagent config dockerWorkDir "/home/ubuntu/work"# Docker 작업 디렉토리
```

---

## 사용 가이드

### 기본 실행 구조

```bash
aiagent "<작업_설명>" <입력_경로> <출력_경로>
```
- **작업_설명**: 수행할 작업을 자연어로 설명 (혹은 텍스트 파일 경로)
- **입력_경로**: 작업에 필요한 파일이 있는 디렉토리 (없으면 생략 가능)
- **출력_경로**: 결과물을 저장할 디렉토리 (별도 설정하지 않으면 AIagent가 자동으로 폴더를 생성)

### 추가 예시

1. 텍스트 파일에 작업 지시
   ```bash
   # task.txt에 작업 내용을 작성해둔 상태라면
   aiagent "task.txt" ./data ./output
   ```

### 작업 설명 작성 팁
- **구체성**: 원하는 작업 결과를 최대한 자세히 기술
- **단계 나누기**: 복잡한 작업은 여러 단계로 분리해 작성
- **조건 명시**: 특별한 조건이나 제한사항이 있다면 분명히 기재

---

## 안전 주의사항

1. **데이터 백업**  
   중요한 파일은 미리 백업하세요. 자동화 과정에서 예기치 않은 오류로 데이터가 손실될 수 있습니다.

2. **보안 및 인터넷 연결**  
   AI가 인터넷 공간에 연결될 수 있으므로, 외부와의 연결을 원하지 않는 경우 네트워크 설정을 조정하거나 가상환경을 주의 깊게 관리해야 합니다.

3. **비용**  
   Claude API 사용 시 [Anthropic API 요금](https://www.anthropic.com/pricing#anthropic-api)이 부과될 수 있으니 결제 설정에 유의하세요.

---

## 문제 해결 가이드

1. **일반 오류**
   - API 키가 유효한지 다시 확인해보세요.
   - 작업 디렉토리 경로나 접근 권한을 재점검하세요.

2. **Docker 관련**
   - Docker Desktop이 정상 실행 중인지 확인
   - 빌드 완료 상태 및 이미지가 존재하는지 확인
   - 메모리/CPU 등 리소스 할당 이슈 체크

---

## 라이선스

본 프로젝트는 [MIT License](LICENSE)를 따르며, 자세한 내용은 LICENSE 파일을 참고해주세요.

---

## 기여 안내

- 버그 보고, 기능 제안, 풀 리퀘스트 모두 환영합니다.  
- GitHub 이슈 트래커를 활용해 제안하거나, 코드 수정 시 테스트 코드를 포함해 풀 리퀘스트를 생성해주세요.

---

## 면책 조항

이 프로젝트를 사용할 경우 발생할 수 있는 모든 문제(데이터 손실, 시스템 에러 등)에 대해서는 사용자 본인이 책임져야 합니다. 중요한 데이터나 시스템에 적용할 때에는 신중한 테스트 후 사용하시기 바랍니다.
