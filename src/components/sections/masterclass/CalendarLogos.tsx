/** Brand marks for the add-to-calendar buttons. Decorative: the label names the app. */

const size = "size-5 shrink-0";

export function GoogleCalendarLogo() {
  return (
    <svg viewBox="0 0 24 24" className={size} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill="#fff" />
      <path
        d="M5.5 3h13A2.5 2.5 0 0 1 21 5.5V7H3V5.5A2.5 2.5 0 0 1 5.5 3Z"
        fill="#4285F4"
      />
      <path d="M3 7h3.5v10.5H3z" fill="#FBBC04" />
      <path d="M3 17.5h13.5V21H5.5A2.5 2.5 0 0 1 3 18.5Z" fill="#34A853" />
      <path d="M17.5 7H21v9.5h-3.5z" fill="#1967D2" />
      <path d="M16.5 16.5H21L16.5 21Z" fill="#EA4335" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="800"
        fontFamily="Arial, sans-serif"
        fill="#1A73E8"
      >
        31
      </text>
    </svg>
  );
}

export function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className={size} aria-hidden="true">
      <path
        fill="#111"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </svg>
  );
}

export function OutlookLogo() {
  return (
    <svg viewBox="0 0 24 24" className={size} aria-hidden="true">
      <rect x="9" y="5" width="13" height="14" rx="1.5" fill="#28A8EA" />
      <path
        d="M9 9.5 15.5 13 22 9.5V17.5a1.5 1.5 0 0 1-1.5 1.5H10.5A1.5 1.5 0 0 1 9 17.5Z"
        fill="#0078D4"
      />
      <rect x="2" y="6.5" width="11" height="11" rx="1.5" fill="#0A64AD" />
      <ellipse
        cx="7.5"
        cy="12"
        rx="2.6"
        ry="3.1"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
      />
    </svg>
  );
}
