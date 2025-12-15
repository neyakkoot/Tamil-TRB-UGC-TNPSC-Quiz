// js/quiz-loader.js (Full code including previous enhancements and NEW Answer Randomization)
document.addEventListener("DOMContentLoaded", function () {
  const quizSelect = document.getElementById("quizSelect");
  const progressEl = document.getElementById("tv-progress");
  const qEl = document.getElementById("tv-question");
  const optsEl = document.getElementById("tv-options");
  const feedbackEl = document.getElementById("tv-feedback");
  const resultsEl = document.getElementById("tv-results");
  const prevBtn = document.getElementById("tv-prev");
  const nextBtn = document.getElementById("tv-next");

  let noteEl = document.getElementById("tv-note");
  if (!noteEl) {
    noteEl = document.createElement("div");
    noteEl.id = "tv-note";
    noteEl.setAttribute("role", "status");
    noteEl.style.marginTop = "0.5rem";
    // Modified note position (based on previous changes)
    const quizNav = document.querySelector('.quiz-nav');
    if (quizNav && quizNav.parentNode) {
      quizNav.parentNode.insertBefore(noteEl, quizNav.nextSibling);
    } else {
      console.warn("tv-note fallback position changed to tv-main bottom.");
      const appContainer = document.getElementById('app-container');
      if (appContainer) {
         appContainer.appendChild(noteEl);
      } else {
         document.body.appendChild(noteEl);
      }
    }
    console.warn("tv-note not found — created fallback element.");
  }

  if (!quizSelect || !progressEl || !qEl || !optsEl || !feedbackEl || !resultsEl || !prevBtn || !nextBtn) {
    console.error("Required UI element missing:", {
      quizSelect, progressEl, qEl, optsEl, feedbackEl, resultsEl, prevBtn, nextBtn
    });
    if (progressEl) progressEl.textContent = "⚠️ UI elements இல்லை — பக்கம் சரிபார்க்கவும்.";
    return;
  }

  let quizData = [];
  let idx = 0;
  let score = 0;
  let currentQuizTitle = '';

  // 🔹 Load quiz list (Categorized)
  async function loadQuizList() {
    try {
      const res = await fetch("quiz-list.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("quiz-list.json not found");
      
      const list = await res.json(); 

      list.forEach(categoryItem => {
        const optGroup = document.createElement("optgroup");
        optGroup.label = categoryItem.category; 

        categoryItem.quizzes.forEach(quizItem => {
          const opt = document.createElement("option");
          opt.value = quizItem.file;
          opt.textContent = quizItem.title;
          optGroup.appendChild(opt);
        });
        
        quizSelect.appendChild(optGroup);
      });

      console.log("✅ Categorized quiz list loaded");
    } catch (err) {
      console.error("❌ Error loading quiz list:", err);
      progressEl.textContent = "⚠️ மேம்படுத்தாத காரணத்தால் வினாடி–வினா பட்டியலை ஏற்ற முடியவில்லை! உருவாக்குநர் விரைந்து அதனைச் செய்வார். எனவே தாங்கள் பிறவற்றைத் தெரிவுசெய்து அறிவைச் சோதியுங்கள்.";
    }
  }


  // 🔹 Load quiz questions
  async function loadQuiz(file) {
    try {
      const res = await fetch(file, { cache: "no-cache" });
      if (!res.ok) throw new Error(`${file} not found`);
      const data = await res.json();
      quizData = data.questions || data;
      if (!quizData || !quizData.length) throw new Error("No questions found");

      // 👑 கேள்விகளைச் சீரற்ற முறையில் வரிசைப்படுத்தல் (Shuffle) - Previous enhancement 👑
      // Fisher-Yates shuffle algorithm
      for (let i = quizData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [quizData[i], quizData[j]] = [quizData[j], quizData[i]];
      }
      // 👑 மாற்றம் முடிவு 👑

      quizData.forEach(q => {
        q.userChoice = undefined;
        // Clear previous state if re-loading the quiz (important for randomization)
        q.shuffledOptions = undefined;
        q.shuffledCorrectIndex = undefined;
      });

      currentQuizTitle = quizSelect.options[quizSelect.selectedIndex].text;

      if (typeof startQuizTimer === 'function') {
        startQuizTimer(quizData.length);
      } else {
        console.warn("startQuizTimer function not found. Is index.html updated?");
      }

      idx = 0;
      score = 0;
      
      const customResults = document.getElementById("tv-results");
      if (customResults) customResults.style.display = "none";
      document.getElementById('tv-progress').style.display = 'block';
      document.getElementById('tv-question').style.display = 'block';
      document.getElementById('tv-options').innerHTML = '';

      renderQuestion();
      console.log(`📘 Quiz loaded: ${file}`);

    } catch (err) {
      console.error("Quiz load error:", err);
      progressEl.textContent = "⚠️ வினாக்களை ஏற்ற முடியவில்லை: " + err.message;
    }
  }

  // 🔹 Render question
  function renderQuestion() {
    const q = quizData[idx];
    if (!q) {
      progressEl.textContent = "⚠️ செல்லுபடியாகாத வினா.";
      return;
    }

    const userChoice = q.userChoice;
    const hasAnswered = (userChoice !== undefined);

    progressEl.textContent = `வினா ${idx + 1} / ${quizData.length}`;
    qEl.textContent = q.question || "வினா கிடைக்கவில்லை.";
    optsEl.innerHTML = "";
    nextBtn.style.display = "inline-block";
    prevBtn.style.display = idx > 0 ? "inline-block" : "none";

    // --- 👑 புதிய மாற்றம்: விடைத் தெரிவுகளைச் சீரற்ற முறையில் வரிசைப்படுத்தல் 👑
    let optionsToRender = q.answerOptions || q.options || [];
    let correctOptionIndex;

    if (!q.shuffledOptions) {
      // 1. விடைத் தெரிவுகளைப் பெறுக
      if (!optionsToRender.length) {
        optsEl.innerHTML = "<p>விருப்பங்கள் இல்லை.</p>";
        return;
      }
      
      // 2. சரியான விடையின் மூல குறியீட்டெண்ணைக் கண்டறிக
      correctOptionIndex = typeof q.answer === "number"
          ? q.answer
          : (optionsToRender?.findIndex(o => o.isCorrect) ?? 0);

      // 3. விருப்பங்களை அவற்றின் மூல குறியீட்டெண்ணுடன் இணைக்க
      const optionsWithIndices = optionsToRender.map((opt, i) => ({ opt, originalIndex: i }));

      // 4. விருப்பங்களைச் சீரமைக்க (Shuffle options)
      // Fisher-Yates shuffle algorithm
      for (let i = optionsWithIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionsWithIndices[i], optionsWithIndices[j]] = [optionsWithIndices[j], optionsWithIndices[i]];
      }

      // 5. சீரமைக்கப்பட்ட விருப்பங்கள் மற்றும் புதிய சரியான குறியீட்டெண்ணைச் சேமிக்க
      q.shuffledOptions = optionsWithIndices.map(item => item.opt);
      q.shuffledCorrectIndex = optionsWithIndices.findIndex(item => item.originalIndex === correctOptionIndex);
    } 

    optionsToRender = q.shuffledOptions;
    correctOptionIndex = q.shuffledCorrectIndex;
    // --- 👑 மாற்றம் முடிவு 👑
    
    // Rendering logic uses the shuffled options and index
    optionsToRender.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.innerHTML = `<strong>${["(அ)", "(ஆ)", "(இ)", "(ஈ)", "(உ)"][i] || (i + 1)}.</strong> ${
        typeof opt === "string" ? opt : opt.text || ""
      }`;

      if (hasAnswered) {
        btn.disabled = true;
        if (i === correctOptionIndex) {
          btn.classList.add("correct");
        }
        // q.userChoice is the index in the *shuffled* list
        if (i === userChoice && userChoice !== correctOptionIndex) {
          btn.classList.add("wrong");
        }
      } else {
        // Pass the index 'i' from the shuffled list
        btn.onclick = () => selectAnswer(i, btn);
      }
      optsEl.appendChild(btn);
    });

    if (hasAnswered) {
      // Explanation must use the original un-shuffled structure for lookup
      const originalOptions = q.answerOptions || q.options || [];
      const originalCorrectIndex = typeof q.answer === "number"
        ? q.answer
        : (originalOptions?.findIndex(o => o.isCorrect) ?? 0);
        
      const explanation =
        q.explanation ||
        originalOptions?.[originalCorrectIndex]?.rationale ||
        "விளக்கம் வழங்கப்படவில்லை.";
        
      feedbackEl.style.display = "block";
      feedbackEl.innerHTML = `<strong>விளக்கம்:</strong> ${explanation}`;
      if (noteEl) noteEl.innerHTML = "✅❌ நீங்கள் ஏற்கனவே பதிலளித்த வினா.";
    } else {
      feedbackEl.style.display = "none";
      if (noteEl) noteEl.innerHTML = "🧾 வினாவை படித்து சரியான விடையைத் தேர்ந்தெடுக்கவும்.";
    }
  }

  // 🔹 Select answer
  function selectAnswer(choice, btn) {
    // --- 👑 புதிய மாற்றம்: செயல்படா நிலை நேரங்காட்டியை Reset செய் 👑 ---
    if (typeof resetInactivityTimer === 'function') {
      resetInactivityTimer();
    }
    // --- 👑 ---
    
    const q = quizData[idx];
    if (!q || q.userChoice !== undefined) {
      return; 
    }
    
    // 'choice' is the index in the *shuffled* list
    q.userChoice = choice;

    // Use the stored shuffled correct index for comparison
    const correctIndex = q.shuffledCorrectIndex; 

    const buttons = optsEl.querySelectorAll("button");
    buttons.forEach(b => (b.disabled = true)); 

    if (choice === correctIndex) {
      score++; 
      btn.classList.add("correct");
      if (noteEl) noteEl.innerHTML = "✅ சரியான விடை!";
    } else {
      btn.classList.add("wrong");
      if (buttons[correctIndex]) buttons[correctIndex].classList.add("correct");
      if (noteEl) noteEl.innerHTML = "❌ தவறான விடை.";
    }

    // Explanation lookup using the original structure (as done in renderQuestion for consistency)
    const originalOptions = q.answerOptions || q.options || [];
    const originalCorrectIndex = typeof q.answer === "number"
      ? q.answer
      : (originalOptions?.findIndex(o => o.isCorrect) ?? 0);

    const explanation =
      q.explanation ||
      originalOptions?.[originalCorrectIndex]?.rationale ||
      "விளக்கம் வழங்கப்படவில்லை.";
      
    feedbackEl.style.display = "block";
    feedbackEl.innerHTML = `<strong>விளக்கம்:</strong> ${explanation}`;
  }

  // 🔹 Navigation buttons
  nextBtn.addEventListener("click", () => {
    // --- 👑 புதிய மாற்றம்: செயல்படா நிலை நேரங்காட்டியை Reset செய் 👑 ---
    if (typeof resetInactivityTimer === 'function') {
      resetInactivityTimer();
    }
    // --- 👑 ---
    
    if (idx < quizData.length - 1) {
      idx++;
      renderQuestion();
    } else {
      showResults();
    }
  });

  prevBtn.addEventListener("click", () => {
    // --- 👑 புதிய மாற்றம்: செயல்படா நிலை நேரங்காட்டியை Reset செய் 👑 ---
    if (typeof resetInactivityTimer === 'function') {
      resetInactivityTimer();
    }
    // --- 👑 ---

    if (idx > 0) {
      idx--;
      renderQuestion();
    }
  });

  // 🔹 Results screen
  function showResults() {
    if (typeof showCustomResults === 'function') {
      showCustomResults(score, quizData.length, currentQuizTitle);
    } else {
      console.error("showCustomResults function not found! Cannot display results.");
      resultsEl.style.display = "block";
      resultsEl.innerHTML = `<h3>மதிப்பெண்: ${score} / ${quizData.length}</h3>
                             <p>முடிவுகளைக் காட்டுவதில் பிழை.</p>`;
    }
  }
  
  // Export showResults for index.html timer
  window.showResults = showResults; 

  // 🔹 Quiz selection
  quizSelect.addEventListener("change", e => {
    if (e.target.value) {
      loadQuiz(e.target.value);
    }
  });

  // Start
  loadQuizList();
});
