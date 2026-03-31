import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/elements/dialog";

interface PrivacyPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyPolicyDialog({
  open,
  onOpenChange,
}: PrivacyPolicyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Privacy Policy</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <p className="text-xs text-gray-400">Last updated: March 2026</p>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              1. Information We Collect
            </h3>
            <p>
              When you sign in with Google, we receive your name, email address,
              and profile picture from your Google account. This information is
              used solely for authentication and displaying your identity within
              the application.
            </p>
            <p className="mt-2">
              We do not collect any personal information from users who use the
              application without signing in.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              2. How We Use Your Information
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Authenticating your identity via Google OAuth</li>
              <li>Displaying your name and profile picture in the app</li>
              <li>Managing shift schedules and staff assignments</li>
              <li>
                Enabling collaboration features (sharing schedules, staff
                invitations)
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              3. Data Storage
            </h3>
            <p>Your data may be stored in the following ways:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                <strong>Local storage (default):</strong> Schedule data is stored
                in your browser's local storage. This data never leaves your
                device.
              </li>
              <li>
                <strong>Google Drive (optional):</strong> If you choose to sync
                with Google Drive, your schedule data is saved to your own Google
                Drive account. We do not have access to your Google Drive files.
              </li>
              <li>
                <strong>Server (paid tiers):</strong> If you use a paid plan,
                schedule and team data is stored on our servers to enable
                collaboration features.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              4. Third-Party Services
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Google OAuth:</strong> Used for authentication. Subject
                to{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google's Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>Google Drive API:</strong> Used only when you explicitly
                enable Drive sync. We request the minimum permissions needed to
                read and write your schedule files.
              </li>
              <li>
                <strong>PostHog Analytics:</strong> Used for anonymous product
                analytics to understand how features are used and improve the
                Service. PostHog receives only anonymous event data (e.g.
                "schedule created" with a count of posts). It does not receive
                any personally identifiable information — no names, emails, IP
                addresses, team names, or business data. All analytics data is
                processed on PostHog's EU servers (Frankfurt). Subject to{" "}
                <a
                  href="https://posthog.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  PostHog's Privacy Policy
                </a>
                .
              </li>
            </ul>
            <p className="mt-2">
              The shift optimization engine (HiGHS.js) runs entirely in your
              browser via WebAssembly. No schedule data is sent to any external
              server for optimization.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              5. Cookies and Tracking
            </h3>
            <p>
              We do not use cookies for tracking purposes. No cookies or
              persistent browser identifiers are set by our analytics. We
              collect anonymous usage data (such as which features are used and
              how often) to improve the Service. This data cannot be used to
              identify you. We do not use advertising services or share data
              with advertisers.
            </p>
            <p className="mt-2">
              If your browser has Do Not Track enabled, no analytics data is
              collected at all.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              6. Data Security
            </h3>
            <p>
              All communication with our servers is encrypted via HTTPS. OAuth
              tokens are managed by Google's authentication flow and are not
              stored by us. Local data remains on your device and is subject to
              your browser's security model.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              7. Your Rights
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Delete local data:</strong> Clear your browser's local
                storage at any time.
              </li>
              <li>
                <strong>Revoke Google access:</strong> Remove Tumbleweed's access
                from your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google Account permissions
                </a>
                .
              </li>
              <li>
                <strong>Request server data deletion:</strong> Contact us to
                request deletion of any data stored on our servers.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              8. Changes to This Policy
            </h3>
            <p>
              We may update this privacy policy from time to time. The "Last
              updated" date at the top of this page reflects the most recent
              revision. Continued use of the application after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              9. Contact Us
            </h3>
            <p>
              If you have questions about this privacy policy or your data,
              please open an issue on our{" "}
              <a
                href="https://github.com/gilador/pakal-shmira/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                GitHub repository
              </a>
              .
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
