import './HelpPage.css';

// 초등학생도 이해할 수 있도록 쉬운 말로 각 기능을 안내하는 정적 도움말 페이지.
function HelpPage() {
  return (
    <div className="help-page">
      <div className="help-header">
        <h2>도움말</h2>
        <p className="help-intro">
          rememo는 내 생각을 메모로 적고, 메모끼리 연결해서 지도처럼 보는 앱이에요. 아래를 순서대로
          따라 하면 금방 익힐 수 있어요! 😊
        </p>
      </div>

      <div className="help-content">
        <div className="help-inner">
          <section className="help-card">
            <h3>📁 1. 메모 보관함(볼트) 만들기</h3>
            <p>
              먼저 메모를 담을 <b>폴더</b>를 하나 정해요. 이 폴더를 "볼트"라고 불러요. 처음 화면에서
              폴더를 고르면, 그 안에 내 메모들이 차곡차곡 저장돼요.
            </p>
            <p className="help-tip">
              💡 메모는 전부 내 컴퓨터에만 저장돼요. 인터넷에 올라가지 않아요.
            </p>
          </section>

          <section className="help-card">
            <h3>📝 2. 메모 쓰고 저장하기</h3>
            <p>
              왼쪽 목록 위의 <b>+</b> 버튼을 눌러 새 메모를 만들어요. 글을 쓰고 나서 <b>Ctrl+S</b>
              (맥은 ⌘+S)를 누르면 저장돼요.
            </p>
            <p className="help-tip">💡 자동 저장은 없어요. 꼭 Ctrl+S로 저장해 주세요!</p>
          </section>

          <section className="help-card">
            <h3>🔗 3. 메모끼리 연결하기 (링크)</h3>
            <p>다른 메모와 연결하고 싶으면 대괄호 두 개로 메모 이름을 감싸요:</p>
            <pre className="help-code">[[카프카]]</pre>
            <p>이렇게 쓰면 "카프카" 메모로 바로 이동할 수 있는 연결이 생겨요.</p>
          </section>

          <section className="help-card">
            <h3>✨ 4. 저절로 연결되기</h3>
            <p>
              대괄호를 쓰지 않아도, 다른 메모의 <b>제목</b>을 그냥 문장 속에 쓰기만 해도 자동으로
              연결돼요. 예를 들어 "카프카"라는 메모가 있으면, 다른 메모에 "오늘 카프카를
              공부했다"라고 쓰기만 해도 둘이 연결돼요.
            </p>
          </section>

          <section className="help-card">
            <h3>🏷️ 5. 태그 붙이기</h3>
            <p>
              글 속에 <b>#</b>을 붙여 주제를 표시해요. 나중에 같은 태그끼리 모아볼 수 있어요.
            </p>
            <pre className="help-code">#공부 #할일 #아이디어</pre>
          </section>

          <section className="help-card">
            <h3>🕸️ 6. 그래프로 보기</h3>
            <p>
              위쪽 <b>그래프</b> 버튼을 누르면, 메모들이 점으로, 연결이 선으로 보여요. 내 생각이
              어떻게 이어져 있는지 지도처럼 한눈에 볼 수 있어요.
            </p>
          </section>

          <section className="help-card">
            <h3>🔍 7. 검색하기</h3>
            <p>
              <b>검색</b> 버튼에서 단어를 넣으면 그 단어가 들어간 메모를 찾아줘요. 태그로도 찾을 수
              있어요.
            </p>
          </section>

          <section className="help-card help-card-highlight">
            <h3>✅ 8. 할 일과 마감 알림</h3>
            <p>
              메모 안에 이렇게 쓰면 "할 일"이 돼요. 대괄호 안이 비어 있으면 아직 안 한 일, <b>x</b>
              가 있으면 다 한 일이에요:
            </p>
            <pre className="help-code">- [ ] 아직 안 한 일{'\n'}- [x] 다 한 일</pre>
            <p>마감일을 붙이고 싶으면 뒤에 날짜를 적어요. 두 가지 방법 다 돼요:</p>
            <pre className="help-code">
              - [ ] 숙제 하기 📅 2026-07-10{'\n'}- [ ] 숙제 하기 @due(2026-07-10)
            </pre>
            <p>시간까지 정하고 싶으면 날짜 뒤에 시각을 적어요:</p>
            <pre className="help-code">- [ ] 학원 가기 📅 2026-07-10 15:30</pre>
            <p>
              위쪽 <b>할 일</b> 버튼을 누르면 모든 할 일이{' '}
              <b>지남 / 오늘 / 예정 / 마감 없음 / 완료</b>로 나뉘어 보여요. 네모(체크박스)를 누르면
              바로 완료로 바뀌고 메모에도 반영돼요.
            </p>
            <p className="help-tip">
              💡 <b>마감일이 있는 할 일만</b> 알림이 와요. 마감일을 안 적으면 알림이 오지 않아요.
              날짜만 적으면 그날 <b>기본 알림 시각</b>(설정에서 바꿀 수 있어요)에, 시각까지 적으면
              그 시각에 알려줘요.
            </p>
          </section>

          <section className="help-card">
            <h3>🔔 9. 알림 설정 바꾸기</h3>
            <p>
              위쪽 <b>설정</b> 버튼에서 알림을 <b>켜고 끌</b> 수 있어요. 시간을 안 적은 할 일에 대해
              몇 시에 알릴지(<b>기본 알림 시각</b>)도 바꿀 수 있어요.
            </p>
          </section>

          <section className="help-card">
            <h3>🖼️ 10. 그림 넣기</h3>
            <p>
              메모를 쓰는 곳에 그림을 <b>복사해서 붙여넣기</b> 하거나 <b>끌어다 놓으면</b> 그림이
              들어가요.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default HelpPage;
