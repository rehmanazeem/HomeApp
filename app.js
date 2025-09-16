// <script>
// --- UI State ---
let sidebarOpen = false;
let currentTheme = localStorage.getItem('theme') || 'light';

// --- MQTT Credentials (imported from secrets file) ---
import { MQTT_BROKER, MQTT_USER, MQTT_PASS } from './mqtt_secrets.js';

// --- MQTT Topics ---
const RELAY1_STATE_TOPIC = 'home/relay1/state';
const RELAY2_STATE_TOPIC = 'home/relay2/state';
const RELAY1_SET_TOPIC = 'home/relay1/set';
const RELAY2_SET_TOPIC = 'home/relay2/set';

// --- Added Strip Topics ---
const STRIP_STATE_TOPIC = 'home/strip/state';
const STRIP_SET_TOPIC = 'home/strip/set';

// --- Theme Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    applyTheme(currentTheme);

    // Initialize iro.js color wheel
    if (window.Iro) {
        const colorWheel = new Iro.ColorPicker("#colorWheel", {
            width: 180,
            color: "#ff9900",
            layout: [
                { component: Iro.components.Wheel },
                { component: Iro.components.Slider, options: { sliderType: 'value' } }
            ]
        });

        colorWheel.on('color:change', function(color) {
            // Send RGB as MQTT command, e.g. "rgb:255,165,0"
            const rgb = color.rgb;
            const rgbCmd = `rgb:${rgb.r},${rgb.g},${rgb.b}`;
            if (typeof client !== 'undefined' && client.connected) {
                client.publish(STRIP_SET_TOPIC, rgbCmd);
            }
        });
    }
});

// --- Tab Switching ---
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.querySelectorAll('[id$="-tab"]').forEach(tab => {
        tab.classList.remove('tab-active');
        tab.classList.add('tab-inactive');
    });
    const tabContent = document.getElementById(tabName + '-content');
    if (tabContent) tabContent.classList.remove('hidden');
    const tab = document.getElementById(tabName + '-tab');
    if (tab) {
        tab.classList.remove('tab-inactive');
        tab.classList.add('tab-active');
    }
    const titles = {
        'home': 'Home Dashboard',
        'devices': 'Device Management',
        'settings': 'Settings'
    };
    const pageTitle = document.getElementById('page-title');
    if (pageTitle && titles[tabName]) {
        pageTitle.textContent = titles[tabName];
    }
    if (window.innerWidth < 768) {
        closeSidebar();
    }
}

// --- Sidebar ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('hamburger');
    sidebarOpen = !sidebarOpen;
    if (sidebarOpen) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        hamburger.classList.add('active');
    } else {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        hamburger.classList.remove('active');
    }
}
function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('hamburger');
    sidebarOpen = false;
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    if (hamburger) hamburger.classList.remove('active');
}

// --- Theme ---
function toggleDarkMode() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
    localStorage.setItem('theme', currentTheme);
}
function setTheme(theme) {
    currentTheme = theme;
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        currentTheme = prefersDark ? 'dark' : 'light';
    }
    applyTheme(currentTheme);
    localStorage.setItem('theme', theme);
}
function applyTheme(theme) {
    const html = document.documentElement;
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    if (theme === 'dark') {
        html.classList.add('dark');
        body.classList.add('dark');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        html.classList.remove('dark');
        body.classList.remove('dark');
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

// --- MQTT Logic ---
let client;
let relay1State = false;
let relay2State = false;
let stripState = false;
let mqttConnected = false;

// Only run MQTT logic if mqtt.js is loaded
if (typeof mqtt !== 'undefined') {
    client = mqtt.connect(MQTT_BROKER, {
        username: MQTT_USER,
        password: MQTT_PASS,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 4000
    });

    client.on('connect', () => {
        mqttConnected = true;
        updateConnectionDot();
        client.subscribe([RELAY1_STATE_TOPIC, RELAY2_STATE_TOPIC, STRIP_STATE_TOPIC]);
    });

    client.on('reconnect', () => {
        mqttConnected = false;
        updateConnectionDot();
    });
    client.on('offline', () => {
        mqttConnected = false;
        updateConnectionDot();
    });
    client.on('close', () => {
        mqttConnected = false;
        updateConnectionDot();
    });
    client.on('error', () => {
        mqttConnected = false;
        updateConnectionDot();
    });

    client.on('message', (topic, message) => {
        const msg = message.toString();
        if (topic === RELAY1_STATE_TOPIC) {
            relay1State = (msg === 'ON');
            updateRelayUI(1, relay1State);
        }
        if (topic === RELAY2_STATE_TOPIC) {
            relay2State = (msg === 'ON');
            updateRelayUI(2, relay2State);
        }
        if (topic === STRIP_STATE_TOPIC) {
            stripState = (msg === 'ON');
            updateStripUI(stripState);
        }
    });

    // Relay toggle event listeners (publish to MQTT topics)
    const relay1Btn = document.getElementById('relay1Btn');
    const relay2Btn = document.getElementById('relay2Btn');
    const stripBtn = document.getElementById('stripBtn');

    if (relay1Btn) {
        relay1Btn.onclick = function() {
            const command = relay1State ? 'OFF' : 'ON';
            client.publish(RELAY1_SET_TOPIC, command);
        };
        relay1Btn.onkeydown = function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                const command = relay1State ? 'OFF' : 'ON';
                client.publish(RELAY1_SET_TOPIC, command);
            }
        };
    }
    if (relay2Btn) {
        relay2Btn.onclick = function() {
            const command = relay2State ? 'OFF' : 'ON';
            client.publish(RELAY2_SET_TOPIC, command);
        };
        relay2Btn.onkeydown = function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                const command = relay2State ? 'OFF' : 'ON';
                client.publish(RELAY2_SET_TOPIC, command);
            }
        };
    }
    // --- Strip Switch Logic ---
    if (stripBtn) {
        stripBtn.onclick = function() {
            const command = stripState ? 'OFF' : 'ON';
            client.publish(STRIP_SET_TOPIC, command);
        };
        stripBtn.onkeydown = function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                const command = stripState ? 'OFF' : 'ON';
                client.publish(STRIP_SET_TOPIC, command);
            }
        };
    }

    // --- Color Tiles Logic ---
    const colorCommands = ['red', 'white', 'cyan', 'magenta', 'green', 'blue'];
    colorCommands.forEach(color => {
        const tile = document.getElementById(`color-tile-${color}`);
        if (tile) {
            tile.onclick = function() {
                client.publish(STRIP_SET_TOPIC, color);
            };
            tile.onkeydown = function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    client.publish(STRIP_SET_TOPIC, color);
                }
            };
        }
    });
}

// --- UI Update Helpers ---
function updateConnectionDot() {
    const dot = document.getElementById('connection-dot');
    const status = document.getElementById('connection-status');
    if (dot) {
        dot.classList.toggle('connected', mqttConnected);
        dot.classList.toggle('disconnected', !mqttConnected);
    }
    if (status) {
        status.textContent = mqttConnected ? 'MQTT Server Connected' : 'MQTT Server Disconnected';
    }
    const label = document.getElementById('connectionStateLabel');
    if (label) {
        label.textContent = mqttConnected ? 'Connected' : 'Disconnected';
        label.style.color = mqttConnected ? '#27ae60' : '#e74c3c';
    }
}

function updateRelayUI(relay, state) {
    const status = document.getElementById(`relay${relay}-status`);
    const time = document.getElementById(`relay${relay}-time`);
    const btn = document.getElementById(`relay${relay}Btn`);
    if (status) status.textContent = state ? 'On' : 'Off';
    if (time) time.textContent = new Date().toLocaleTimeString();
    if (btn) {
        btn.classList.toggle('active', state);
        btn.setAttribute('aria-pressed', state ? 'true' : 'false');
    }
    const label = document.getElementById(`relay${relay}StateLabel`);
    if (label) {
        label.textContent = state ? 'ON' : 'OFF';
        label.style.color = state ? '#27ae60' : '#e74c3c';
    }
}

// --- Strip UI Update Helper ---
function updateStripUI(state) {
    const status = document.getElementById('strip-status');
    const time = document.getElementById('strip-time');
    const btn = document.getElementById('stripBtn');
    if (status) status.textContent = state ? 'On' : 'Off';
    if (time) time.textContent = new Date().toLocaleTimeString();
    if (btn) {
        btn.classList.toggle('active', state);
        btn.setAttribute('aria-pressed', state ? 'true' : 'false');
    }
    const label = document.getElementById('stripStateLabel');
    if (label) {
        label.textContent = state ? 'ON' : 'OFF';
        label.style.color = state ? '#27ae60' : '#e74c3c';
    }
}

// --- Responsive Sidebar ---
window.addEventListener('resize', function() {
    if (window.innerWidth >= 768) {
        closeSidebar();
    }
});

// --- System Theme Change ---
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    if (localStorage.getItem('theme') === 'auto') {
        currentTheme = e.matches ? 'dark' : 'light';
        applyTheme(currentTheme);
    }
});

// Make tab/theme functions globally accessible for HTML onclick handlers
window.switchTab = switchTab;
window.toggleDarkMode = toggleDarkMode;
window.setTheme = setTheme;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
// </script>