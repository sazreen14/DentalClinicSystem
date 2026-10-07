export default function NotificationPreferencesStatus({ state }) {
  return <>
    {state.loading && <p role="status" className="portal-settings-note">Loading notification preferences...</p>}
    {state.error && <div role="alert" className="portal-settings-note">{state.error}{!state.loaded && !state.loading && <button type="button" onClick={state.retry}>Retry</button>}</div>}
    {state.message && <p role="status" className="portal-settings-note">{state.message}</p>}
  </>;
}
