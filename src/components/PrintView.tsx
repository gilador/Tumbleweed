import { createPortal } from "react-dom";
import { useRecoilValue } from "recoil";
import { useTranslation } from "react-i18next";
import { shiftState, getActiveRosterFromState } from "../stores/shiftStore";
import tumbleweedIcon from "../../assets/tumbleweed.svg";
import { getDaySlice, getDisplayTime } from "../service/weeklyScheduleUtils";
import { getDayLabel, getTodayISO } from "../service/dayLabelUtils";

function PrintViewContent() {
  const { t, i18n } = useTranslation();
  const state = useRecoilValue(shiftState);
  const activeRoster = getActiveRosterFromState(state);
  const { posts, hours, assignments, endTime, customCellDisplayNames, scheduleMode, startDate } = activeRoster;
  const { userShiftData } = state;
  const locale = i18n.language === "he" ? "he-IL" : "en-US";
  const isWeekly = scheduleMode === "7d";
  const numDays = isWeekly ? 7 : 1;

  const resolveUserName = (postIndex: number, hourIndex: number): string => {
    const slotKey = `${postIndex}-${hourIndex}`;
    if (customCellDisplayNames?.[slotKey]) return customCellDisplayNames[slotKey];
    const userId = assignments?.[postIndex]?.[hourIndex];
    if (!userId) return "\u2014";
    const user = userShiftData?.find((u) => u.user.id === userId);
    return user?.user.name || "\u2014";
  };

  const getTimeRange = (hourIndex: number): string => {
    const rawStart = hours?.[hourIndex]?.value || "";
    const start = isWeekly ? getDisplayTime(rawStart) : rawStart;
    const rawEnd = hourIndex + 1 < (hours?.length || 0)
      ? hours[hourIndex + 1].value
      : endTime || "";
    const end = isWeekly ? getDisplayTime(rawEnd) : rawEnd;
    return `${start}-${end}`;
  };

  if (!posts?.length || !hours?.length) return null;

  return createPortal(
    <div id="print-view" className="print-only" dir="rtl">
      <div style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#000",
        maxWidth: "100%",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: "100vh",
      }}>
        {Array.from({ length: numDays }, (_, dayIdx) => {
          const slice = isWeekly
            ? getDaySlice(hours.length, dayIdx)
            : { start: 0, end: hours.length };
          const dayHourIndices = Array.from(
            { length: slice.end - slice.start },
            (__, i) => slice.start + i
          );

          return (
            <div key={dayIdx} style={dayIdx > 0 ? { pageBreakBefore: "always" } : undefined}>
              {/* Day header for weekly mode */}
              {isWeekly && (
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "1rem 0 0.5rem" }}>
                  {getDayLabel(startDate || getTodayISO(), dayIdx, locale)}
                </h2>
              )}

              {/* Table */}
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.875rem",
              }}>
                <thead>
                  <tr>
                    <th style={{
                      border: "1px solid #000",
                      padding: "0.5rem",
                      textAlign: "right",
                      backgroundColor: "#f5f5f5",
                    }}>
                      {t("post")}
                    </th>
                    {dayHourIndices.map((hIdx) => (
                      <th
                        key={hIdx}
                        style={{
                          border: "1px solid #000",
                          padding: "0.5rem",
                          textAlign: "center",
                          backgroundColor: "#f5f5f5",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span dir="ltr">{getTimeRange(hIdx)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post, pIdx) => (
                    <tr key={post.id}>
                      <td style={{
                        border: "1px solid #000",
                        padding: "0.5rem",
                        fontWeight: 600,
                        textAlign: "right",
                      }}>
                        {post.value}
                      </td>
                      {dayHourIndices.map((hIdx) => (
                        <td
                          key={hIdx}
                          style={{
                            border: "1px solid #000",
                            padding: "0.5rem",
                            textAlign: "center",
                          }}
                        >
                          {resolveUserName(pIdx, hIdx)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Footer */}
        <div dir="ltr" style={{
          marginTop: "2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          fontSize: "0.75rem",
          color: "#666",
        }}>
          <span>{t("poweredBy")}</span>
          <img
            src={tumbleweedIcon}
            alt="Tumbleweed"
            style={{ width: "20px", height: "20px" }}
          />
          <span>Tumbleweed</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function PrintView() {
  return <PrintViewContent />;
}
