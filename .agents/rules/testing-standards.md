---
description: System testing and quality assurance rules for the ERP application
always_on: true
---

# ERP System Testing Standards

When the user asks to test the system or verify functionality:
1. **Always test full end-to-end user flows** instead of isolated static checks.
2. **Validate Data Consistency**: Check stock balances, payment ledgers, and contact balances before and after operations.
3. **Check Browser Console Errors**: Ensure no unhandled React state errors, Supabase query rejections, or missing key warnings exist.
4. **Produce a Structured Test Report Artifact**: Present findings with clear status indicators (✅ Pass, ⚠️ Warning, ❌ Fail), reproduction steps, and root cause analysis.
