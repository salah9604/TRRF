// app.js (ES Module)

// Firebase (Modular) via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    query,
    orderBy,
    enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
/**
 * 1) ضع إعدادات Firebase بتاعتك هنا
 * - لازم Firestore يكون متفعل في المشروع
 */
const firebaseConfig = {
    // 👇 استبدل القيم دي بتاعت مشروعك
    apiKey: "AIzaSyAh-PbBku0MypujI3jH6liOGfWkEkoBcX0",
    authDomain: "trff-a1afb.firebaseapp.com",
    projectId: "trff-a1afb",
    storageBucket: "trff-a1afb.firebasestorage.app",
    messagingSenderId: "323000148109",
    appId: "1:323000148109:web:2856cf168893ff95e3c2c4",
    measurementId: "G-8W2FTRPWMJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// Offline-first: يخزن في IndexedDB ويعمل sync تلقائي أول ما النت يرجع
enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Persistence not enabled:", err?.code || err);
});
// Collection name
const TEAMS_COL = "ramadan_teams";

// UI refs
const addTeamBtn = document.getElementById("addTeamBtn");
const teamModal = document.getElementById("teamModal");
const modalTitle = document.getElementById("modalTitle");
const modalSub = document.getElementById("modalSub");
const saveBtn = document.getElementById("saveBtn");
const formErr = document.getElementById("formErr");

const teamNameEl = document.getElementById("teamName");
const divisionEl = document.getElementById("division");
const s1El = document.getElementById("s1");
const s2El = document.getElementById("s2");
const s3El = document.getElementById("s3");
const s4El = document.getElementById("s4");
const s5El = document.getElementById("s5");
const s6El = document.getElementById("s6");
const teamsGrid = document.getElementById("teamsGrid");
const footHint = document.getElementById("footHint");

const kpiTeams = document.getElementById("kpiTeams");
const kpiPlayers = document.getElementById("kpiPlayers");
const kpiWeDo = document.getElementById("kpiWeDo");
const kpiEV3 = document.getElementById("kpiEV3");

const searchInput = document.getElementById("searchInput");
const divisionFilter = document.getElementById("divisionFilter");

const toast = document.getElementById("toast");

// State
let allTeams = [];
let editingId = null; // null => add, otherwise edit

// Helpers
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
}

function openModal(mode = "add", team = null) {
    formErr.textContent = "";
    if (mode === "add") {
        editingId = null;
        modalTitle.textContent = "Add Team";
        modalSub.textContent = "تسجيل فريق جديد";
        teamNameEl.value = "";
        divisionEl.value = "ev3-robosoccer";
        [s1El, s2El, s3El, s4El, s5El, s6El].forEach(el => el.value = "");
    } else {
        editingId = team.id;
        modalTitle.textContent = "Edit Team";
        modalSub.textContent = "تعديل بيانات الفريق";
        teamNameEl.value = team.teamName || "";
        divisionEl.value = team.division || "ev3-robosoccer"; s2El.value = (team.players?.[1] || "") || "";
        s1El.value = team.players?.[0] || "";
        s2El.value = team.players?.[1] || "";
        s3El.value = team.players?.[2] || "";
        s4El.value = team.players?.[3] || "";
        s5El.value = team.players?.[4] || "";
        s6El.value = team.players?.[5] || "";
    }
    teamModal.classList.add("show");
}

function closeModal() {
    teamModal.classList.remove("show");
}

function normalize(s) {
    return (s || "").toString().trim().toLowerCase();
}

function validateForm() {
    const teamName = teamNameEl.value.trim();
    const division = divisionEl.value.trim();

    if (!teamName) return "لازم تكتب اسم الفريق.";
    if (!division) return "لازم تختار القسم.";

    const players = [
        s1El.value.trim(),
        s2El.value.trim(),
        s3El.value.trim(),
        s4El.value.trim(),
        s5El.value.trim(),
        s6El.value.trim()
    ].filter(Boolean);

    if (players.length === 0) return "لازم تدخل أسماء طلاب.";

    // منع التكرار
    const uniq = new Set(players.map(p => p.toLowerCase()));
    if (uniq.size !== players.length) return "فيه أسماء مكررة داخل نفس الفريق.";

    // قواعد حسب القسم
    if (division === "wedo-robosoccer") {
        if (players.length < 2 || players.length > 3)
            return "قسم WeDo لازم 2 أو 3 طلاب.";
    }

    if (division === "ev3-robosoccer") {
        if (players.length < 2 || players.length > 3)
            return "قسم EV3 RoboSoccer لازم 3 طلاب بالضبط.";
    }

    if (division === "ev3-sumo") {
        if (players.length < 2 || players.length > 6)
            return "قسم EV3 Sumo يسمح من 3 لحد 6 طلاب.";
    }

    return null;
}
function getFilteredTeams() {
    const qText = normalize(searchInput.value);
    const div = divisionFilter.value;

    return allTeams.filter(t => {
        const matchesDiv = (div === "ALL") || (t.division === div);
        if (!matchesDiv) return false;

        if (!qText) return true;

        const hay = [
            t.teamName,
            t.division,
            ...(t.players || [])
        ].map(normalize).join(" ");

        return hay.includes(qText);
    });
}

function formatTime(ts) {
    try {
        if (!ts) return "—";
        // Firestore Timestamp => .toDate()
        const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
        return new Intl.DateTimeFormat("ar-EG", {
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit"
        }).format(d);
    } catch {
        return "—";
    }
}

function render() {
    const teams = getFilteredTeams();

    // KPIs (على كل الداتا مش الفلتر)
    const totalTeams = allTeams.length;
    const totalPlayers = allTeams.reduce((acc, t) => acc + (t.players?.length || 0), 0);
    const ev3Soccer = allTeams.filter(t => t.division === "ev3-robosoccer").length;
    const wedoSoccer = allTeams.filter(t => t.division === "wedo-robosoccer").length;
    const ev3Sumo = allTeams.filter(t => t.division === "ev3-sumo").length;

    document.getElementById("kpiEv3Soccer").textContent = ev3Soccer;
    document.getElementById("kpiWeDoSoccer").textContent = wedoSoccer;
    document.getElementById("kpiEv3Sumo").textContent = ev3Sumo; kpiTeams.textContent = totalTeams;
    kpiPlayers.textContent = totalPlayers;

    teamsGrid.innerHTML = "";

    if (!teams.length) {
        teamsGrid.innerHTML = `
      <div class="teamCard card" style="grid-column:1/-1">
        <h3 class="teamName" style="margin:0 0 6px">مفيش نتائج</h3>
        <div class="muted">جرّب تغير البحث أو الفلتر.</div>
      </div>
    `;
        footHint.textContent = `0 فريق ظاهر`;
        return;
    }

    teams.forEach(team => {
        const created = formatTime(team.createdAt);
        const players = (team.players || []).map((p, i) => `${i + 1}) ${p}`).join("<br/>");

        const card = document.createElement("div");
        card.className = "teamCard card";
        card.innerHTML = `
      <div class="teamTop">
        <div>
          <h3 class="teamName">${team.teamName}</h3>
          <div class="muted">Created: ${created}</div>
        </div>
        <div class="badge">
            ${team.division}${team._pending ? " • Pending" : ""}
        </div>
      </div>

      <div class="list">
        <div><strong>Players</strong></div>
        <div>${players || "—"}</div>
      </div>

      <div class="actionsRow">
        <button class="btn" data-edit="${team.id}">Edit</button>
        <button class="btn danger" data-del="${team.id}">Delete</button>
      </div>
    `;

        teamsGrid.appendChild(card);
    });

    footHint.textContent = `${teams.length} فريق ظاهر من إجمالي ${allTeams.length}`;
}

async function addTeamToFirestore(payload) {
    await addDoc(collection(db, TEAMS_COL), payload);
}

async function updateTeamInFirestore(id, payload) {
    await updateDoc(doc(db, TEAMS_COL, id), payload);
}

async function deleteTeamFromFirestore(id) {
    await deleteDoc(doc(db, TEAMS_COL, id));
}

// Events
addTeamBtn.addEventListener("click", () => openModal("add"));

teamModal.addEventListener("click", (e) => {
    const el = e.target;
    if (el?.dataset?.close) closeModal();
});

saveBtn.addEventListener("click", async () => {
    formErr.textContent = "";
    const err = validateForm();
    if (err) {
        formErr.textContent = err;
        return;
    }

    const teamName = teamNameEl.value.trim();
    const division = divisionEl.value.trim();
    const players = [
        s1El.value.trim(),
        s2El.value.trim(),
        s3El.value.trim(),
        s4El.value.trim(),
        s5El.value.trim(),
        s6El.value.trim()
    ].filter(Boolean);
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        if (!editingId) {
            await addTeamToFirestore({
                teamName,
                division,
                players,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            showToast("تم إضافة الفريق.");
        } else {
            await updateTeamInFirestore(editingId, {
                teamName,
                division,
                players,
                updatedAt: serverTimestamp()
            });
            showToast("تم تحديث الفريق.");
        }
        closeModal();
    } catch (e) {
        console.error(e);
        formErr.textContent = "حصل خطأ أثناء الحفظ. راجع إعدادات Firebase و Firestore Rules.";
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save";
    }
});

teamsGrid.addEventListener("click", async (e) => {
    const el = e.target;

    const editId = el?.dataset?.edit;
    const delId = el?.dataset?.del;

    if (editId) {
        const team = allTeams.find(t => t.id === editId);
        if (team) openModal("edit", team);
        return;
    }

    if (delId) {
        const team = allTeams.find(t => t.id === delId);
        const ok = confirm(`تأكيد حذف فريق: ${team?.teamName || ""} ؟`);
        if (!ok) return;

        try {
            await deleteTeamFromFirestore(delId);
            showToast("تم حذف الفريق.");
        } catch (e2) {
            console.error(e2);
            showToast("فشل الحذف. راجع الصلاحيات.");
        }
    }
});

searchInput.addEventListener("input", render);
divisionFilter.addEventListener("change", render);

// Live listener
const qTeams = query(collection(db, TEAMS_COL), orderBy("createdAt", "desc"));
onSnapshot(
    qTeams,
    { includeMetadataChanges: true },
    (snap) => {
        allTeams = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            _pending: d.metadata.hasPendingWrites
        }));
        render();
    },
    (err) => {
        console.error(err);
        footHint.textContent = "فشل تحميل البيانات. راجع Firebase Config و Firestore Rules.";
        showToast("فشل الاتصال بقاعدة البيانات.");
    }
);
// Initial render (empty)
render();