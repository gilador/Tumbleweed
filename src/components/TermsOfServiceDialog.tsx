import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/elements/dialog";

interface TermsOfServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TermsOfServiceDialog({
  open,
  onOpenChange,
}: TermsOfServiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Terms of Service</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <p className="text-xs text-gray-400">Last updated: March 2026</p>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              1. Acceptance of Terms
            </h3>
            <p>
              By accessing or using Tumbleweed ("the Service"), you agree to be
              bound by these Terms of Service. If you do not agree to these
              terms, do not use the Service.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              2. Description of Service
            </h3>
            <p>
              Tumbleweed is a shift scheduling optimization tool for restaurants.
              The Service allows managers to create shift schedules, manage
              staff, and optimize assignments using a client-side linear
              programming engine. The Service is available as a free tier
              (client-side only) and paid tiers (with server-based collaboration
              features).
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              3. User Accounts
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                You may sign in using your Google account. You are responsible
                for maintaining the security of your account credentials.
              </li>
              <li>
                You are responsible for all activity that occurs under your
                account.
              </li>
              <li>
                You must provide accurate information when creating or using your
                account.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              4. Acceptable Use
            </h3>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                Use the Service for any unlawful purpose or in violation of any
                applicable laws
              </li>
              <li>
                Attempt to gain unauthorized access to any part of the Service
              </li>
              <li>
                Interfere with or disrupt the Service or servers connected to it
              </li>
              <li>
                Reverse engineer, decompile, or disassemble any part of the
                Service, except as permitted by applicable law
              </li>
              <li>
                Use the Service to store or transmit malicious code or harmful
                content
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              5. Data and Content
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                You retain ownership of all data you enter into the Service
                (schedules, staff information, shift configurations).
              </li>
              <li>
                Free tier data is stored locally in your browser or optionally in
                your Google Drive. We do not access or claim rights to this data.
              </li>
              <li>
                Paid tier data stored on our servers is used solely to provide
                the Service. We do not sell or share your data with third
                parties.
              </li>
              <li>
                We collect anonymous, non-identifiable usage analytics (e.g.
                feature usage counts) to improve the Service. This data contains
                no personal information and cannot be traced back to any
                individual user or business. See our Privacy Policy for details.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              6. Scheduling Optimization
            </h3>
            <p>
              The shift optimization engine runs entirely in your browser. While
              we strive to provide accurate and optimal scheduling results, the
              optimization output is provided "as is." You are responsible for
              reviewing and approving all shift assignments before publishing
              them to staff. Tumbleweed is not liable for scheduling decisions
              made based on the optimization output.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              7. Service Availability
            </h3>
            <p>
              We strive to keep the Service available at all times but do not
              guarantee uninterrupted access. The Service may be temporarily
              unavailable due to maintenance, updates, or circumstances beyond
              our control. The free tier operates entirely client-side and is
              available offline after initial load.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              8. Paid Plans
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Paid plans are billed on a recurring basis as specified at the
                time of purchase.
              </li>
              <li>
                You may cancel your subscription at any time. Access to paid
                features continues until the end of the current billing period.
              </li>
              <li>
                We reserve the right to change pricing with reasonable notice.
                Existing subscriptions will be honored until their next renewal
                date.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              9. Limitation of Liability
            </h3>
            <p>
              To the maximum extent permitted by law, Tumbleweed and its
              creators shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the
              Service, including but not limited to lost profits, data loss, or
              business interruption.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              10. Disclaimer of Warranties
            </h3>
            <p>
              The Service is provided "as is" and "as available" without
              warranties of any kind, either express or implied, including but
              not limited to implied warranties of merchantability, fitness for a
              particular purpose, and non-infringement.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              11. Changes to Terms
            </h3>
            <p>
              We may update these Terms of Service from time to time. The "Last
              updated" date at the top reflects the most recent revision.
              Continued use of the Service after changes constitutes acceptance
              of the updated terms.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              12. Governing Law
            </h3>
            <p>
              These terms shall be governed by and construed in accordance with
              the laws of the State of Israel, without regard to its conflict of
              law provisions.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base text-gray-900 mb-2">
              13. Contact
            </h3>
            <p>
              If you have questions about these terms, please open an issue on
              our{" "}
              <a
                href="https://github.com/gilador/Tumbleweed/issues"
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
