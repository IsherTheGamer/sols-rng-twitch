#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const STAMP = Date.now();
const FULL_FILES = [
  {
    "path": "src/pages/api/discord-interactions.ts",
    "base64": "aW1wb3J0IHR5cGUgeyBOZXh0QXBpUmVxdWVzdCwgTmV4dEFwaVJlc3BvbnNlIH0gZnJvbSAibmV4dCI7CmltcG9ydCB7IGNyZWF0ZVB1YmxpY0tleSwgdmVyaWZ5IGFzIHZlcmlmeVNpZ25hdHVyZSB9IGZyb20gImNyeXB0byI7CmltcG9ydCB7IHdhaXRVbnRpbCB9IGZyb20gIkB2ZXJjZWwvZnVuY3Rpb25zIjsKaW1wb3J0IHsKICBhdXRvY29tcGxldGVUd2l0Y2hDb21tYW5kcywKICBleGVjdXRlVHdpdGNoQ29tbWFuZCwKICBmb3JtYXREaXNjb3JkVHdpdGNoTGluaywKICBmb3JtYXRUd2l0Y2hDb21tYW5kQ2F0YWxvZywKICBnZXREaXNjb3JkVHdpdGNoTGluaywKICBnZXRUd2l0Y2hDb21tYW5kLAogIHJlbW92ZURpc2NvcmRUd2l0Y2hMaW5rLAogIHNldERpc2NvcmRUd2l0Y2hMaW5rLAogIHR5cGUgRGlzY29yZEJyaWRnZVVzZXIsCn0gZnJvbSAiQC9saWIvZGlzY29yZC1jb21tYW5kLWJyaWRnZSI7CgppbnRlcmZhY2UgRGlzY29yZE9wdGlvbiB7CiAgbmFtZTogc3RyaW5nOwogIHR5cGU6IG51bWJlcjsKICB2YWx1ZT86IHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW47CiAgb3B0aW9ucz86IERpc2NvcmRPcHRpb25bXTsKICBmb2N1c2VkPzogYm9vbGVhbjsKfQoKaW50ZXJmYWNlIERpc2NvcmRVc2VyIHsKICBpZDogc3RyaW5nOwogIHVzZXJuYW1lOiBzdHJpbmc7CiAgZ2xvYmFsX25hbWU/OiBzdHJpbmcgfCBudWxsOwp9CgppbnRlcmZhY2UgRGlzY29yZEludGVyYWN0aW9uIHsKICBpZD86IHN0cmluZzsKICBhcHBsaWNhdGlvbl9pZD86IHN0cmluZzsKICB0b2tlbj86IHN0cmluZzsKICB0eXBlOiBudW1iZXI7CiAgZ3VpbGRfaWQ/OiBzdHJpbmc7CiAgbWVtYmVyPzogeyB1c2VyPzogRGlzY29yZFVzZXIgfTsKICB1c2VyPzogRGlzY29yZFVzZXI7CiAgZGF0YT86IHsKICAgIG5hbWU/OiBzdHJpbmc7CiAgICBvcHRpb25zPzogRGlzY29yZE9wdGlvbltdOwogIH07Cn0KCmludGVyZmFjZSBDYWNoZWRJbnRlcmFjdGlvblRhc2sgewogIGV4cGlyZXNBdDogbnVtYmVyOwogIHByb21pc2U6IFByb21pc2U8c3RyaW5nPjsKfQoKY29uc3QgSU5URVJBQ1RJT05fVEFTS1MgPSBuZXcgTWFwPHN0cmluZywgQ2FjaGVkSW50ZXJhY3Rpb25UYXNrPigpOwpjb25zdCBJTlRFUkFDVElPTl9UQVNLX1RUTF9NUyA9IDIgKiA2MCAqIDEwMDA7CmNvbnN0IElOVEVSQUNUSU9OX1RBU0tfTUFYID0gNTAwOwoKZXhwb3J0IGNvbnN0IGNvbmZpZyA9IHsKICBhcGk6IHsKICAgIGJvZHlQYXJzZXI6IGZhbHNlLAogIH0sCiAgbWF4RHVyYXRpb246IDYwLAp9OwoKYXN5bmMgZnVuY3Rpb24gcmVhZFJhd0JvZHkocmVxOiBOZXh0QXBpUmVxdWVzdCk6IFByb21pc2U8QnVmZmVyPiB7CiAgY29uc3QgY2h1bmtzOiBCdWZmZXJbXSA9IFtdOwoKICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlcSkgewogICAgY2h1bmtzLnB1c2goQnVmZmVyLmlzQnVmZmVyKGNodW5rKSA/IGNodW5rIDogQnVmZmVyLmZyb20oY2h1bmspKTsKICB9CgogIHJldHVybiBCdWZmZXIuY29uY2F0KGNodW5rcyk7Cn0KCmZ1bmN0aW9uIGZpcnN0SGVhZGVyKHZhbHVlOiBzdHJpbmcgfCBzdHJpbmdbXSB8IHVuZGVmaW5lZCk6IHN0cmluZyB7CiAgcmV0dXJuIEFycmF5LmlzQXJyYXkodmFsdWUpID8gdmFsdWVbMF0gPz8gIiIgOiB2YWx1ZSA/PyAiIjsKfQoKZnVuY3Rpb24gdmVyaWZ5RGlzY29yZFJlcXVlc3QoCiAgcmF3Qm9keTogQnVmZmVyLAogIHNpZ25hdHVyZTogc3RyaW5nLAogIHRpbWVzdGFtcDogc3RyaW5nCik6IGJvb2xlYW4gewogIGNvbnN0IHJhd1B1YmxpY0tleSA9IHByb2Nlc3MuZW52LkRJU0NPUkRfUFVCTElDX0tFWTsKICBpZiAoIXJhd1B1YmxpY0tleSB8fCAhc2lnbmF0dXJlIHx8ICF0aW1lc3RhbXApIHJldHVybiBmYWxzZTsKCiAgdHJ5IHsKICAgIGNvbnN0IHB1YmxpY0tleUJ5dGVzID0gQnVmZmVyLmZyb20ocmF3UHVibGljS2V5LCAiaGV4Iik7CiAgICBjb25zdCBzcGtpUHJlZml4ID0gQnVmZmVyLmZyb20oIjMwMmEzMDA1MDYwMzJiNjU3MDAzMjEwMCIsICJoZXgiKTsKICAgIGNvbnN0IHB1YmxpY0tleSA9IGNyZWF0ZVB1YmxpY0tleSh7CiAgICAgIGtleTogQnVmZmVyLmNvbmNhdChbc3BraVByZWZpeCwgcHVibGljS2V5Qnl0ZXNdKSwKICAgICAgZm9ybWF0OiAiZGVyIiwKICAgICAgdHlwZTogInNwa2kiLAogICAgfSk7CgogICAgcmV0dXJuIHZlcmlmeVNpZ25hdHVyZSgKICAgICAgbnVsbCwKICAgICAgQnVmZmVyLmNvbmNhdChbQnVmZmVyLmZyb20odGltZXN0YW1wKSwgcmF3Qm9keV0pLAogICAgICBwdWJsaWNLZXksCiAgICAgIEJ1ZmZlci5mcm9tKHNpZ25hdHVyZSwgImhleCIpCiAgICApOwogIH0gY2F0Y2ggewogICAgcmV0dXJuIGZhbHNlOwogIH0KfQoKZnVuY3Rpb24gY2xlYW4oY29udGVudDogc3RyaW5nKTogc3RyaW5nIHsKICByZXR1cm4gKGNvbnRlbnQucmVwbGFjZSgvXHMrL2csICIgIikudHJpbSgpIHx8ICJDb21tYW5kIGNvbXBsZXRlZC4iKS5zbGljZSgKICAgIDAsCiAgICAxOTAwCiAgKTsKfQoKZnVuY3Rpb24gcmVzcG9uZCgKICByZXM6IE5leHRBcGlSZXNwb25zZSwKICBjb250ZW50OiBzdHJpbmcsCiAgZXBoZW1lcmFsID0gZmFsc2UKKSB7CiAgcmV0dXJuIHJlcy5zdGF0dXMoMjAwKS5qc29uKHsKICAgIHR5cGU6IDQsCiAgICBkYXRhOiB7CiAgICAgIGNvbnRlbnQ6IGNsZWFuKGNvbnRlbnQpLAogICAgICBmbGFnczogZXBoZW1lcmFsID8gNjQgOiB1bmRlZmluZWQsCiAgICAgIGFsbG93ZWRfbWVudGlvbnM6IHsgcGFyc2U6IFtdIH0sCiAgICB9LAogIH0pOwp9CgpmdW5jdGlvbiBhdXRvY29tcGxldGUoCiAgcmVzOiBOZXh0QXBpUmVzcG9uc2UsCiAgY2hvaWNlczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfT4KKSB7CiAgcmV0dXJuIHJlcy5zdGF0dXMoMjAwKS5qc29uKHsKICAgIHR5cGU6IDgsCiAgICBkYXRhOiB7IGNob2ljZXM6IGNob2ljZXMuc2xpY2UoMCwgMjUpIH0sCiAgfSk7Cn0KCmZ1bmN0aW9uIGRlZmVyKHJlczogTmV4dEFwaVJlc3BvbnNlLCBlcGhlbWVyYWwgPSBmYWxzZSkgewogIHJldHVybiByZXMuc3RhdHVzKDIwMCkuanNvbih7CiAgICB0eXBlOiA1LAogICAgZGF0YTogeyBmbGFnczogZXBoZW1lcmFsID8gNjQgOiB1bmRlZmluZWQgfSwKICB9KTsKfQoKZnVuY3Rpb24gZ2V0VXNlcihpbnRlcmFjdGlvbjogRGlzY29yZEludGVyYWN0aW9uKTogRGlzY29yZFVzZXIgfCBudWxsIHsKICByZXR1cm4gaW50ZXJhY3Rpb24ubWVtYmVyPy51c2VyID8/IGludGVyYWN0aW9uLnVzZXIgPz8gbnVsbDsKfQoKZnVuY3Rpb24gYnJpZGdlVXNlcih1c2VyOiBEaXNjb3JkVXNlcik6IERpc2NvcmRCcmlkZ2VVc2VyIHsKICByZXR1cm4gewogICAgaWQ6IHVzZXIuaWQsCiAgICB1c2VybmFtZTogdXNlci51c2VybmFtZSwKICAgIGdsb2JhbE5hbWU6IHVzZXIuZ2xvYmFsX25hbWUsCiAgfTsKfQoKZnVuY3Rpb24gYWRtaW5JZHMoKTogU2V0PHN0cmluZz4gewogIHJldHVybiBuZXcgU2V0KAogICAgKHByb2Nlc3MuZW52LkRJU0NPUkRfQURNSU5fVVNFUl9JRFMgPz8gIiIpCiAgICAgIC5zcGxpdCgvWyxcc10rLykKICAgICAgLm1hcCgoaWQpID0+IGlkLnRyaW0oKSkKICAgICAgLmZpbHRlcihCb29sZWFuKQogICk7Cn0KCmZ1bmN0aW9uIGlzRGlzY29yZEFkbWluKGludGVyYWN0aW9uOiBEaXNjb3JkSW50ZXJhY3Rpb24pOiBib29sZWFuIHsKICBjb25zdCB1c2VyID0gZ2V0VXNlcihpbnRlcmFjdGlvbik7CiAgaWYgKCF1c2VyIHx8ICFhZG1pbklkcygpLmhhcyh1c2VyLmlkKSkgcmV0dXJuIGZhbHNlOwoKICBjb25zdCBndWlsZE9ubHkgPQogICAgKHByb2Nlc3MuZW52LkRJU0NPUkRfQURNSU5fR1VJTERfT05MWSA/PyAiZmFsc2UiKQogICAgICAudHJpbSgpCiAgICAgIC50b0xvd2VyQ2FzZSgpID09PSAidHJ1ZSI7CgogIGlmICghZ3VpbGRPbmx5KSByZXR1cm4gdHJ1ZTsKCiAgY29uc3QgY29uZmlndXJlZEd1aWxkID0gcHJvY2Vzcy5lbnYuRElTQ09SRF9HVUlMRF9JRDsKICByZXR1cm4gIWNvbmZpZ3VyZWRHdWlsZCB8fCBpbnRlcmFjdGlvbi5ndWlsZF9pZCA9PT0gY29uZmlndXJlZEd1aWxkOwp9CgpmdW5jdGlvbiBzdWJjb21tYW5kKGludGVyYWN0aW9uOiBEaXNjb3JkSW50ZXJhY3Rpb24pOiB7CiAgbmFtZTogc3RyaW5nOwogIG9wdGlvbnM6IERpc2NvcmRPcHRpb25bXTsKfSB7CiAgY29uc3Qgb3B0aW9uID0gaW50ZXJhY3Rpb24uZGF0YT8ub3B0aW9ucz8uWzBdOwogIHJldHVybiB7CiAgICBuYW1lOiBvcHRpb24/Lm5hbWUgPz8gImNvbW1hbmRzIiwKICAgIG9wdGlvbnM6IG9wdGlvbj8ub3B0aW9ucyA/PyBbXSwKICB9Owp9CgpmdW5jdGlvbiBvcHRpb25WYWx1ZSgKICBvcHRpb25zOiBEaXNjb3JkT3B0aW9uW10sCiAgbmFtZTogc3RyaW5nLAogIGZhbGxiYWNrID0gIiIKKTogc3RyaW5nIHsKICBjb25zdCB2YWx1ZSA9IG9wdGlvbnMuZmluZCgob3B0aW9uKSA9PiBvcHRpb24ubmFtZSA9PT0gbmFtZSk/LnZhbHVlOwogIHJldHVybiB2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsID8gZmFsbGJhY2sgOiBTdHJpbmcodmFsdWUpOwp9CgpmdW5jdGlvbiBvcHRpb25Cb29sZWFuKAogIG9wdGlvbnM6IERpc2NvcmRPcHRpb25bXSwKICBuYW1lOiBzdHJpbmcsCiAgZmFsbGJhY2sgPSBmYWxzZQopOiBib29sZWFuIHsKICBjb25zdCB2YWx1ZSA9IG9wdGlvbnMuZmluZCgob3B0aW9uKSA9PiBvcHRpb24ubmFtZSA9PT0gbmFtZSk/LnZhbHVlOwogIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICJib29sZWFuIiA/IHZhbHVlIDogZmFsbGJhY2s7Cn0KCmZ1bmN0aW9uIGZvY3VzZWRPcHRpb24ob3B0aW9uczogRGlzY29yZE9wdGlvbltdKTogRGlzY29yZE9wdGlvbiB8IHVuZGVmaW5lZCB7CiAgcmV0dXJuIG9wdGlvbnMuZmluZCgob3B0aW9uKSA9PiBvcHRpb24uZm9jdXNlZCk7Cn0KCmZ1bmN0aW9uIHBydW5lSW50ZXJhY3Rpb25UYXNrcyhub3cgPSBEYXRlLm5vdygpKTogdm9pZCB7CiAgZm9yIChjb25zdCBba2V5LCBlbnRyeV0gb2YgSU5URVJBQ1RJT05fVEFTS1MpIHsKICAgIGlmIChlbnRyeS5leHBpcmVzQXQgPD0gbm93KSBJTlRFUkFDVElPTl9UQVNLUy5kZWxldGUoa2V5KTsKICB9CgogIHdoaWxlIChJTlRFUkFDVElPTl9UQVNLUy5zaXplID4gSU5URVJBQ1RJT05fVEFTS19NQVgpIHsKICAgIGNvbnN0IG9sZGVzdCA9IElOVEVSQUNUSU9OX1RBU0tTLmtleXMoKS5uZXh0KCkudmFsdWU7CiAgICBpZiAoIW9sZGVzdCkgYnJlYWs7CiAgICBJTlRFUkFDVElPTl9UQVNLUy5kZWxldGUob2xkZXN0KTsKICB9Cn0KCmZ1bmN0aW9uIGdldE9yQ3JlYXRlSW50ZXJhY3Rpb25UYXNrKAogIGludGVyYWN0aW9uOiBEaXNjb3JkSW50ZXJhY3Rpb24sCiAgZmFjdG9yeTogKCkgPT4gUHJvbWlzZTxzdHJpbmc+Cik6IFByb21pc2U8c3RyaW5nPiB7CiAgY29uc3QgaWQgPSBpbnRlcmFjdGlvbi5pZD8udHJpbSgpOwogIGlmICghaWQpIHJldHVybiBmYWN0b3J5KCk7CgogIGNvbnN0IG5vdyA9IERhdGUubm93KCk7CiAgY29uc3QgY2FjaGVkID0gSU5URVJBQ1RJT05fVEFTS1MuZ2V0KGlkKTsKCiAgaWYgKGNhY2hlZCAmJiBjYWNoZWQuZXhwaXJlc0F0ID4gbm93KSB7CiAgICByZXR1cm4gY2FjaGVkLnByb21pc2U7CiAgfQoKICBjb25zdCBwcm9taXNlID0gZmFjdG9yeSgpOwogIElOVEVSQUNUSU9OX1RBU0tTLnNldChpZCwgewogICAgZXhwaXJlc0F0OiBub3cgKyBJTlRFUkFDVElPTl9UQVNLX1RUTF9NUywKICAgIHByb21pc2UsCiAgfSk7CiAgcHJ1bmVJbnRlcmFjdGlvblRhc2tzKG5vdyk7CiAgcmV0dXJuIHByb21pc2U7Cn0KCmFzeW5jIGZ1bmN0aW9uIHNsZWVwKG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHsKICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpOwp9Cgphc3luYyBmdW5jdGlvbiBlZGl0T3JpZ2luYWxSZXNwb25zZSgKICBpbnRlcmFjdGlvbjogRGlzY29yZEludGVyYWN0aW9uLAogIGNvbnRlbnQ6IHN0cmluZwopOiBQcm9taXNlPHZvaWQ+IHsKICBjb25zdCBhcHBsaWNhdGlvbklkID0KICAgIGludGVyYWN0aW9uLmFwcGxpY2F0aW9uX2lkID8/CiAgICBwcm9jZXNzLmVudi5ESVNDT1JEX0FQUExJQ0FUSU9OX0lEID8/CiAgICAiIjsKICBjb25zdCB0b2tlbiA9IGludGVyYWN0aW9uLnRva2VuID8/ICIiOwoKICBpZiAoIWFwcGxpY2F0aW9uSWQgfHwgIXRva2VuKSB7CiAgICBjb25zb2xlLmVycm9yKCJbZGlzY29yZF0gTWlzc2luZyBhcHBsaWNhdGlvbiBJRCBvciBpbnRlcmFjdGlvbiB0b2tlbi4iKTsKICAgIHJldHVybjsKICB9CgogIGNvbnN0IHVybCA9CiAgICBgaHR0cHM6Ly9kaXNjb3JkLmNvbS9hcGkvdjEwL3dlYmhvb2tzLyR7YXBwbGljYXRpb25JZH0vJHt0b2tlbn1gICsKICAgICIvbWVzc2FnZXMvQG9yaWdpbmFsIjsKCiAgY29uc3QgYm9keSA9IEpTT04uc3RyaW5naWZ5KHsKICAgIGNvbnRlbnQ6IGNsZWFuKGNvbnRlbnQpLAogICAgYWxsb3dlZF9tZW50aW9uczogeyBwYXJzZTogW10gfSwKICB9KTsKCiAgZm9yIChsZXQgYXR0ZW1wdCA9IDA7IGF0dGVtcHQgPCA0OyBhdHRlbXB0KyspIHsKICAgIGlmIChhdHRlbXB0ID4gMCkgYXdhaXQgc2xlZXAoMjUwICogYXR0ZW1wdCk7CgogICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHsKICAgICAgbWV0aG9kOiAiUEFUQ0giLAogICAgICBoZWFkZXJzOiB7ICJDb250ZW50LVR5cGUiOiAiYXBwbGljYXRpb24vanNvbiIgfSwKICAgICAgYm9keSwKICAgIH0pOwoKICAgIGlmIChyZXNwb25zZS5vaykgcmV0dXJuOwoKICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSkgewogICAgICB0cnkgewogICAgICAgIGNvbnN0IHJhdGVMaW1pdCA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIHsKICAgICAgICAgIHJldHJ5X2FmdGVyPzogbnVtYmVyOwogICAgICAgIH07CiAgICAgICAgYXdhaXQgc2xlZXAoTWF0aC5tYXgoMjUwLCAocmF0ZUxpbWl0LnJldHJ5X2FmdGVyID8/IDAuNSkgKiAxMDAwKSk7CiAgICAgICAgY29udGludWU7CiAgICAgIH0gY2F0Y2ggewogICAgICAgIGNvbnRpbnVlOwogICAgICB9CiAgICB9CgogICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDA0KSBjb250aW51ZTsKCiAgICBjb25zb2xlLmVycm9yKAogICAgICBgW2Rpc2NvcmRdIEZhaWxlZCB0byBlZGl0IGRlZmVycmVkIHJlcGx5OiBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfSAkeygKICAgICAgICBhd2FpdCByZXNwb25zZS50ZXh0KCkKICAgICAgKS5zbGljZSgwLCAyMDApfWAKICAgICk7CiAgICByZXR1cm47CiAgfQoKICBjb25zb2xlLmVycm9yKCJbZGlzY29yZF0gRGVmZXJyZWQgcmVwbHkgd2FzIG5vdCBhdmFpbGFibGUgYWZ0ZXIgcmV0cmllcy4iKTsKfQoKZnVuY3Rpb24gZGVmZXJUd2l0Y2hDb21tYW5kKAogIHJlcTogTmV4dEFwaVJlcXVlc3QsCiAgcmVzOiBOZXh0QXBpUmVzcG9uc2UsCiAgaW50ZXJhY3Rpb246IERpc2NvcmRJbnRlcmFjdGlvbiwKICBjb21tYW5kVGV4dDogc3RyaW5nLAogIGFyZ3VtZW50c1RleHQ6IHN0cmluZywKICBlcGhlbWVyYWw6IGJvb2xlYW4KKSB7CiAgY29uc3QgdXNlciA9IGdldFVzZXIoaW50ZXJhY3Rpb24pOwoKICBpZiAoIXVzZXIpIHsKICAgIHJldHVybiByZXNwb25kKHJlcywgIkRpc2NvcmQgdXNlciBpbmZvcm1hdGlvbiBpcyBtaXNzaW5nLiIsIHRydWUpOwogIH0KCiAgY29uc3QgdGFzayA9IGdldE9yQ3JlYXRlSW50ZXJhY3Rpb25UYXNrKGludGVyYWN0aW9uLCAoKSA9PgogICAgZXhlY3V0ZVR3aXRjaENvbW1hbmQoewogICAgICByZXEsCiAgICAgIGd1aWxkSWQ6IGludGVyYWN0aW9uLmd1aWxkX2lkLAogICAgICBkaXNjb3JkVXNlcjogYnJpZGdlVXNlcih1c2VyKSwKICAgICAgY29tbWFuZFRleHQsCiAgICAgIGFyZ3VtZW50c1RleHQsCiAgICAgIGlzQWRtaW46IGlzRGlzY29yZEFkbWluKGludGVyYWN0aW9uKSwKICAgIH0pCiAgKTsKCiAgd2FpdFVudGlsKAogICAgdGFzawogICAgICAudGhlbigoY29udGVudCkgPT4gZWRpdE9yaWdpbmFsUmVzcG9uc2UoaW50ZXJhY3Rpb24sIGNvbnRlbnQpKQogICAgICAuY2F0Y2goKGVycm9yKSA9PgogICAgICAgIGVkaXRPcmlnaW5hbFJlc3BvbnNlKAogICAgICAgICAgaW50ZXJhY3Rpb24sCiAgICAgICAgICBg4p2MIERpc2NvcmQgYnJpZGdlIGZhaWxlZDogJHsKICAgICAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpCiAgICAgICAgICB9YAogICAgICAgICkKICAgICAgKQogICk7CgogIHJldHVybiBkZWZlcihyZXMsIGVwaGVtZXJhbCk7Cn0KCmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUxpbmsoCiAgaW50ZXJhY3Rpb246IERpc2NvcmRJbnRlcmFjdGlvbiwKICBvcHRpb25zOiBEaXNjb3JkT3B0aW9uW10KKTogUHJvbWlzZTxzdHJpbmc+IHsKICBpZiAoIWlzRGlzY29yZEFkbWluKGludGVyYWN0aW9uKSkgewogICAgcmV0dXJuICLinYwgT25seSBjb25maWd1cmVkIERpc2NvcmQgYWRtaW5zIGNhbiBsaW5rIFR3aXRjaCBzYXZlcy4iOwogIH0KCiAgY29uc3QgaW52b2tlciA9IGdldFVzZXIoaW50ZXJhY3Rpb24pOwogIGlmICghaW52b2tlcikgcmV0dXJuICJEaXNjb3JkIHVzZXIgaW5mb3JtYXRpb24gaXMgbWlzc2luZy4iOwoKICBjb25zdCB0YXJnZXRJZCA9IG9wdGlvblZhbHVlKG9wdGlvbnMsICJ0YXJnZXQiKSB8fCBpbnZva2VyLmlkOwogIGNvbnN0IHR3aXRjaFVzZXJuYW1lID0gb3B0aW9uVmFsdWUob3B0aW9ucywgInR3aXRjaF91c2VybmFtZSIpOwogIGNvbnN0IHR3aXRjaFVzZXJJZCA9IG9wdGlvblZhbHVlKG9wdGlvbnMsICJ0d2l0Y2hfdXNlcl9pZCIpOwoKICBjb25zdCBsaW5rID0gYXdhaXQgc2V0RGlzY29yZFR3aXRjaExpbmsoewogICAgZ3VpbGRJZDogaW50ZXJhY3Rpb24uZ3VpbGRfaWQsCiAgICBkaXNjb3JkVXNlcklkOiB0YXJnZXRJZCwKICAgIHR3aXRjaFVzZXJuYW1lLAogICAgdHdpdGNoVXNlcklkLAogICAgdHdpdGNoRGlzcGxheU5hbWU6IHR3aXRjaFVzZXJuYW1lLAogICAgbGlua2VkQnlEaXNjb3JkVXNlcklkOiBpbnZva2VyLmlkLAogIH0pOwoKICByZXR1cm4gYOKchSBMaW5rZWQgPEAke3RhcmdldElkfT4gdG8gVHdpdGNoIEAke2xpbmsudHdpdGNoVXNlcm5hbWV9IChJRCAke2xpbmsudHdpdGNoVXNlcklkfSkuIERpc2NvcmQgYW5kIFR3aXRjaCBub3cgdXNlIHRoZSBzYW1lIHNhdmUuYDsKfQoKYXN5bmMgZnVuY3Rpb24gaGFuZGxlVW5saW5rKAogIGludGVyYWN0aW9uOiBEaXNjb3JkSW50ZXJhY3Rpb24sCiAgb3B0aW9uczogRGlzY29yZE9wdGlvbltdCik6IFByb21pc2U8c3RyaW5nPiB7CiAgaWYgKCFpc0Rpc2NvcmRBZG1pbihpbnRlcmFjdGlvbikpIHsKICAgIHJldHVybiAi4p2MIE9ubHkgY29uZmlndXJlZCBEaXNjb3JkIGFkbWlucyBjYW4gdW5saW5rIFR3aXRjaCBzYXZlcy4iOwogIH0KCiAgY29uc3QgaW52b2tlciA9IGdldFVzZXIoaW50ZXJhY3Rpb24pOwogIGlmICghaW52b2tlcikgcmV0dXJuICJEaXNjb3JkIHVzZXIgaW5mb3JtYXRpb24gaXMgbWlzc2luZy4iOwoKICBjb25zdCB0YXJnZXRJZCA9IG9wdGlvblZhbHVlKG9wdGlvbnMsICJ0YXJnZXQiKSB8fCBpbnZva2VyLmlkOwogIGNvbnN0IHJlbW92ZWQgPSBhd2FpdCByZW1vdmVEaXNjb3JkVHdpdGNoTGluaygKICAgIGludGVyYWN0aW9uLmd1aWxkX2lkLAogICAgdGFyZ2V0SWQKICApOwoKICByZXR1cm4gcmVtb3ZlZAogICAgPyBg4pyFIFJlbW92ZWQgdGhlIFR3aXRjaCBsaW5rIGZvciA8QCR7dGFyZ2V0SWR9Pi5gCiAgICA6IGA8QCR7dGFyZ2V0SWR9PiBkaWQgbm90IGhhdmUgYSBUd2l0Y2ggbGluay5gOwp9Cgphc3luYyBmdW5jdGlvbiBoYW5kbGVXaG9BbUkoCiAgaW50ZXJhY3Rpb246IERpc2NvcmRJbnRlcmFjdGlvbiwKICBvcHRpb25zOiBEaXNjb3JkT3B0aW9uW10KKTogUHJvbWlzZTxzdHJpbmc+IHsKICBjb25zdCBpbnZva2VyID0gZ2V0VXNlcihpbnRlcmFjdGlvbik7CiAgaWYgKCFpbnZva2VyKSByZXR1cm4gIkRpc2NvcmQgdXNlciBpbmZvcm1hdGlvbiBpcyBtaXNzaW5nLiI7CgogIGNvbnN0IHRhcmdldElkID0gb3B0aW9uVmFsdWUob3B0aW9ucywgInRhcmdldCIpIHx8IGludm9rZXIuaWQ7CgogIGlmICh0YXJnZXRJZCAhPT0gaW52b2tlci5pZCAmJiAhaXNEaXNjb3JkQWRtaW4oaW50ZXJhY3Rpb24pKSB7CiAgICByZXR1cm4gIuKdjCBPbmx5IERpc2NvcmQgYWRtaW5zIGNhbiBpbnNwZWN0IGFub3RoZXIgdXNlcidzIGxpbmsuIjsKICB9CgogIGNvbnN0IGxpbmsgPSBhd2FpdCBnZXREaXNjb3JkVHdpdGNoTGluaygKICAgIGludGVyYWN0aW9uLmd1aWxkX2lkLAogICAgdGFyZ2V0SWQKICApOwoKICByZXR1cm4gZm9ybWF0RGlzY29yZFR3aXRjaExpbmsobGluaywgdGFyZ2V0SWQpOwp9CgpleHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBoYW5kbGVyKAogIHJlcTogTmV4dEFwaVJlcXVlc3QsCiAgcmVzOiBOZXh0QXBpUmVzcG9uc2UKKSB7CiAgaWYgKHJlcS5tZXRob2QgIT09ICJQT1NUIikgewogICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA1KS5zZW5kKCJNZXRob2QgTm90IEFsbG93ZWQiKTsKICB9CgogIGNvbnN0IHJhd0JvZHkgPSBhd2FpdCByZWFkUmF3Qm9keShyZXEpOwogIGNvbnN0IHNpZ25hdHVyZSA9IGZpcnN0SGVhZGVyKHJlcS5oZWFkZXJzWyJ4LXNpZ25hdHVyZS1lZDI1NTE5Il0pOwogIGNvbnN0IHRpbWVzdGFtcCA9IGZpcnN0SGVhZGVyKHJlcS5oZWFkZXJzWyJ4LXNpZ25hdHVyZS10aW1lc3RhbXAiXSk7CgogIGlmICghdmVyaWZ5RGlzY29yZFJlcXVlc3QocmF3Qm9keSwgc2lnbmF0dXJlLCB0aW1lc3RhbXApKSB7CiAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDEpLnNlbmQoIkludmFsaWQgcmVxdWVzdCBzaWduYXR1cmUiKTsKICB9CgogIGxldCBpbnRlcmFjdGlvbjogRGlzY29yZEludGVyYWN0aW9uOwoKICB0cnkgewogICAgaW50ZXJhY3Rpb24gPSBKU09OLnBhcnNlKAogICAgICByYXdCb2R5LnRvU3RyaW5nKCJ1dGY4IikKICAgICkgYXMgRGlzY29yZEludGVyYWN0aW9uOwogIH0gY2F0Y2ggewogICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5zZW5kKCJJbnZhbGlkIEpTT04iKTsKICB9CgogIGlmIChpbnRlcmFjdGlvbi50eXBlID09PSAxKSB7CiAgICByZXR1cm4gcmVzLnN0YXR1cygyMDApLmpzb24oeyB0eXBlOiAxIH0pOwogIH0KCiAgaWYgKGludGVyYWN0aW9uLnR5cGUgPT09IDQpIHsKICAgIGlmIChpbnRlcmFjdGlvbi5kYXRhPy5uYW1lICE9PSAic29scyIpIHsKICAgICAgcmV0dXJuIGF1dG9jb21wbGV0ZShyZXMsIFtdKTsKICAgIH0KCiAgICBjb25zdCBjdXJyZW50ID0gc3ViY29tbWFuZChpbnRlcmFjdGlvbik7CiAgICBjb25zdCBmb2N1c2VkID0gZm9jdXNlZE9wdGlvbihjdXJyZW50Lm9wdGlvbnMpOwoKICAgIGlmIChjdXJyZW50Lm5hbWUgPT09ICJydW4iICYmIGZvY3VzZWQ/Lm5hbWUgPT09ICJjb21tYW5kIikgewogICAgICByZXR1cm4gYXV0b2NvbXBsZXRlKAogICAgICAgIHJlcywKICAgICAgICBhdXRvY29tcGxldGVUd2l0Y2hDb21tYW5kcyhTdHJpbmcoZm9jdXNlZC52YWx1ZSA/PyAiIikpCiAgICAgICk7CiAgICB9CgogICAgcmV0dXJuIGF1dG9jb21wbGV0ZShyZXMsIFtdKTsKICB9CgogIGlmIChpbnRlcmFjdGlvbi50eXBlICE9PSAyKSB7CiAgICByZXR1cm4gcmVzcG9uZChyZXMsICJVbnN1cHBvcnRlZCBpbnRlcmFjdGlvbi4iLCB0cnVlKTsKICB9CgogIGNvbnN0IGRpcmVjdENvbW1hbmQgPSBnZXRUd2l0Y2hDb21tYW5kKGludGVyYWN0aW9uLmRhdGE/Lm5hbWUpOwoKICBpZiAoZGlyZWN0Q29tbWFuZCkgewogICAgY29uc3Qgb3B0aW9ucyA9IGludGVyYWN0aW9uLmRhdGE/Lm9wdGlvbnMgPz8gW107CgogICAgcmV0dXJuIGRlZmVyVHdpdGNoQ29tbWFuZCgKICAgICAgcmVxLAogICAgICByZXMsCiAgICAgIGludGVyYWN0aW9uLAogICAgICBkaXJlY3RDb21tYW5kLm5hbWUsCiAgICAgIG9wdGlvblZhbHVlKG9wdGlvbnMsICJhcmd1bWVudHMiKSwKICAgICAgb3B0aW9uQm9vbGVhbihvcHRpb25zLCAicHJpdmF0ZSIsIGZhbHNlKQogICAgKTsKICB9CgogIGlmIChpbnRlcmFjdGlvbi5kYXRhPy5uYW1lICE9PSAic29scyIpIHsKICAgIHJldHVybiByZXNwb25kKHJlcywgIlVuc3VwcG9ydGVkIGNvbW1hbmQuIiwgdHJ1ZSk7CiAgfQoKICBjb25zdCBjdXJyZW50ID0gc3ViY29tbWFuZChpbnRlcmFjdGlvbik7CgogIHRyeSB7CiAgICBpZiAoY3VycmVudC5uYW1lID09PSAicnVuIikgewogICAgICByZXR1cm4gZGVmZXJUd2l0Y2hDb21tYW5kKAogICAgICAgIHJlcSwKICAgICAgICByZXMsCiAgICAgICAgaW50ZXJhY3Rpb24sCiAgICAgICAgb3B0aW9uVmFsdWUoY3VycmVudC5vcHRpb25zLCAiY29tbWFuZCIpLAogICAgICAgIG9wdGlvblZhbHVlKGN1cnJlbnQub3B0aW9ucywgImFyZ3VtZW50cyIpLAogICAgICAgIG9wdGlvbkJvb2xlYW4oY3VycmVudC5vcHRpb25zLCAicHJpdmF0ZSIsIGZhbHNlKQogICAgICApOwogICAgfQoKICAgIGlmIChjdXJyZW50Lm5hbWUgPT09ICJjb21tYW5kcyIpIHsKICAgICAgcmV0dXJuIHJlc3BvbmQoCiAgICAgICAgcmVzLAogICAgICAgIGZvcm1hdFR3aXRjaENvbW1hbmRDYXRhbG9nKAogICAgICAgICAgb3B0aW9uVmFsdWUoY3VycmVudC5vcHRpb25zLCAic2VhcmNoIiksCiAgICAgICAgICBvcHRpb25WYWx1ZShjdXJyZW50Lm9wdGlvbnMsICJwYWdlIiwgIjEiKSwKICAgICAgICAgIG9wdGlvblZhbHVlKGN1cnJlbnQub3B0aW9ucywgImNhdGVnb3J5IiwgImFsbCIpCiAgICAgICAgKSwKICAgICAgICBvcHRpb25Cb29sZWFuKGN1cnJlbnQub3B0aW9ucywgInByaXZhdGUiLCB0cnVlKQogICAgICApOwogICAgfQoKICAgIGlmIChjdXJyZW50Lm5hbWUgPT09ICJsaW5rIikgewogICAgICByZXR1cm4gcmVzcG9uZCgKICAgICAgICByZXMsCiAgICAgICAgYXdhaXQgaGFuZGxlTGluayhpbnRlcmFjdGlvbiwgY3VycmVudC5vcHRpb25zKSwKICAgICAgICB0cnVlCiAgICAgICk7CiAgICB9CgogICAgaWYgKGN1cnJlbnQubmFtZSA9PT0gInVubGluayIpIHsKICAgICAgcmV0dXJuIHJlc3BvbmQoCiAgICAgICAgcmVzLAogICAgICAgIGF3YWl0IGhhbmRsZVVubGluayhpbnRlcmFjdGlvbiwgY3VycmVudC5vcHRpb25zKSwKICAgICAgICB0cnVlCiAgICAgICk7CiAgICB9CgogICAgaWYgKGN1cnJlbnQubmFtZSA9PT0gIndob2FtaSIpIHsKICAgICAgcmV0dXJuIHJlc3BvbmQoCiAgICAgICAgcmVzLAogICAgICAgIGF3YWl0IGhhbmRsZVdob0FtSShpbnRlcmFjdGlvbiwgY3VycmVudC5vcHRpb25zKSwKICAgICAgICB0cnVlCiAgICAgICk7CiAgICB9CgogICAgcmV0dXJuIHJlc3BvbmQoCiAgICAgIHJlcywKICAgICAgIlVua25vd24gL3NvbHMgdXRpbGl0eS4gVXNlIC9zb2xzIGNvbW1hbmRzIG9yIC9zb2xzIHJ1bi4iLAogICAgICB0cnVlCiAgICApOwogIH0gY2F0Y2ggKGVycm9yKSB7CiAgICByZXR1cm4gcmVzcG9uZCgKICAgICAgcmVzLAogICAgICBg4p2MIENvbW1hbmQgZmFpbGVkOiAkewogICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKQogICAgICB9YCwKICAgICAgdHJ1ZQogICAgKTsKICB9Cn0K"
  },
  {
    "path": "src/lib/state.ts",
    "base64": "aW1wb3J0IHsgUmVkaXMgfSBmcm9tICJAdXBzdGFzaC9yZWRpcyI7CmltcG9ydCB0eXBlIHsgQ2hhbm5lbFN0YXRlIH0gZnJvbSAiLi4vdHlwZXMvZGF0YSI7CgpsZXQgcmVkaXM6IFJlZGlzIHwgbnVsbCA9IG51bGw7CgpmdW5jdGlvbiBnZXRSZWRpcygpOiBSZWRpcyB8IG51bGwgewogIGlmIChyZWRpcykgcmV0dXJuIHJlZGlzOwogIGNvbnN0IHVybCA9IHByb2Nlc3MuZW52LlVQU1RBU0hfUkVESVNfUkVTVF9VUkw7CiAgY29uc3QgdG9rZW4gPSBwcm9jZXNzLmVudi5VUFNUQVNIX1JFRElTX1JFU1RfVE9LRU47CiAgaWYgKCF1cmwgfHwgIXRva2VuKSByZXR1cm4gbnVsbDsKICByZWRpcyA9IG5ldyBSZWRpcyh7IHVybCwgdG9rZW4gfSk7CiAgcmV0dXJuIHJlZGlzOwp9Cgpjb25zdCBERUZBVUxUX1NUQVRFID0gKAogIGNoYW5uZWxJZDogc3RyaW5nLAogIGNoYW5uZWxOYW1lOiBzdHJpbmcKKTogQ2hhbm5lbFN0YXRlID0+ICh7CiAgY2hhbm5lbElkLAogIGNoYW5uZWxOYW1lLAogIGJpb21lSWQ6ICJub3JtYWwiLAogIGJpb21lRXhwaXJlc0F0OiAwLAogIHRpbWVPZkRheTogImRheXRpbWUiLAogIHRpbWVFeHBpcmVzQXQ6IERhdGUubm93KCkgKyAxNTAwMDAsCiAgYWN0aXZlRXZlbnRzOiBbXSwKICBhY3RpdmVEZXZCaW9tZTogbnVsbCwKICBkZXZFeHBpcmVzQXQ6IDAsCiAgYmxvb2RSYWluRXhwaXJlc0F0OiAwLAogIGxhc3RTdGF0dXNBdDogMCwKICBsYXN0VGlja0F0OiBEYXRlLm5vdygpLAogIGRldmljZVNlcnZlckNvb2xkb3duVW50aWw6IDAsCiAgc3RyYW5nZUNvbnRyb2xsZXJDb29sZG93blVudGlsOiAwLAogIGJpb21lUmFuZG9taXplckNvb2xkb3duVW50aWw6IDAsCn0pOwoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldENoYW5uZWxTdGF0ZSgKICBjaGFubmVsSWQ6IHN0cmluZywKICBjaGFubmVsTmFtZSA9ICJkZWZhdWx0IgopOiBQcm9taXNlPENoYW5uZWxTdGF0ZT4gewogIGNvbnN0IHIgPSBnZXRSZWRpcygpOwogIGlmICghcikgcmV0dXJuIERFRkFVTFRfU1RBVEUoY2hhbm5lbElkLCBjaGFubmVsTmFtZSk7CiAgY29uc3Qga2V5ID0gYGNoYW5uZWw6JHtjaGFubmVsSWR9OnN0YXRlYDsKICBjb25zdCBkYXRhID0gYXdhaXQgci5nZXQ8Q2hhbm5lbFN0YXRlPihrZXkpOwogIGlmICghZGF0YSkgcmV0dXJuIERFRkFVTFRfU1RBVEUoY2hhbm5lbElkLCBjaGFubmVsTmFtZSk7CiAgcmV0dXJuIGRhdGE7Cn0KCmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXRDaGFubmVsU3RhdGUoCiAgc3RhdGU6IENoYW5uZWxTdGF0ZQopOiBQcm9taXNlPHZvaWQ+IHsKICBjb25zdCByID0gZ2V0UmVkaXMoKTsKICBpZiAoIXIpIHJldHVybjsKICBhd2FpdCByLnNldChgY2hhbm5lbDoke3N0YXRlLmNoYW5uZWxJZH06c3RhdGVgLCBzdGF0ZSk7Cn0KCmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRDb29sZG93bihrZXk6IHN0cmluZyk6IFByb21pc2U8bnVtYmVyPiB7CiAgY29uc3QgciA9IGdldFJlZGlzKCk7CiAgaWYgKCFyKSByZXR1cm4gMDsKICBjb25zdCB2YWx1ZSA9IGF3YWl0IHIuZ2V0PG51bWJlcj4oa2V5KTsKICByZXR1cm4gdmFsdWUgPz8gMDsKfQoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldENvb2xkb3duKAogIGtleTogc3RyaW5nLAogIHVudGlsOiBudW1iZXIKKTogUHJvbWlzZTx2b2lkPiB7CiAgY29uc3QgciA9IGdldFJlZGlzKCk7CiAgaWYgKCFyKSByZXR1cm47CiAgY29uc3QgdHRsID0gTWF0aC5tYXgoMSwgTWF0aC5jZWlsKCh1bnRpbCAtIERhdGUubm93KCkpIC8gMTAwMCkpOwogIGF3YWl0IHIuc2V0KGtleSwgdW50aWwsIHsgZXg6IHR0bCB9KTsKfQoKLyoqCiAqIEFjcXVpcmVzIGEgY29vbGRvd24gYXRvbWljYWxseS4KICoKICogU3VjY2Vzc2Z1bCByZXF1ZXN0cyB1c2Ugb25lIFJlZGlzIGNvbW1hbmQuIEEgYmxvY2tlZCByZXF1ZXN0IHBlcmZvcm1zIG9uZQogKiBleHRyYSByZWFkIG9ubHkgc28gdGhlIHVzZXIgY2FuIHNlZSB0aGUgcmVtYWluaW5nIHRpbWUuCiAqLwpleHBvcnQgYXN5bmMgZnVuY3Rpb24gYWNxdWlyZUNvb2xkb3duKAogIGtleTogc3RyaW5nLAogIGNvb2xkb3duTXM6IG51bWJlcgopOiBQcm9taXNlPHsgYWxsb3dlZDogYm9vbGVhbjsgcmVtYWluaW5nTXM6IG51bWJlciB9PiB7CiAgY29uc3QgciA9IGdldFJlZGlzKCk7CiAgaWYgKCFyKSByZXR1cm4geyBhbGxvd2VkOiB0cnVlLCByZW1haW5pbmdNczogMCB9OwoKICBjb25zdCBzYWZlTXMgPSBNYXRoLm1heCgxLCBNYXRoLmZsb29yKGNvb2xkb3duTXMpKTsKICBjb25zdCBub3cgPSBEYXRlLm5vdygpOwogIGNvbnN0IHVudGlsID0gbm93ICsgc2FmZU1zOwoKICBjb25zdCBhY3F1aXJlZCA9IGF3YWl0IHIuc2V0KGtleSwgdW50aWwsIHsKICAgIG54OiB0cnVlLAogICAgcHg6IHNhZmVNcywKICB9KTsKCiAgaWYgKGFjcXVpcmVkKSB7CiAgICByZXR1cm4geyBhbGxvd2VkOiB0cnVlLCByZW1haW5pbmdNczogMCB9OwogIH0KCiAgY29uc3QgZXhpc3RpbmcgPSAoYXdhaXQgci5nZXQ8bnVtYmVyPihrZXkpKSA/PyAwOwoKICBpZiAoZXhpc3RpbmcgPD0gRGF0ZS5ub3coKSkgewogICAgY29uc3QgcmV0cnlOb3cgPSBEYXRlLm5vdygpOwogICAgY29uc3QgcmV0cnlVbnRpbCA9IHJldHJ5Tm93ICsgc2FmZU1zOwogICAgY29uc3QgcmV0cmllZCA9IGF3YWl0IHIuc2V0KGtleSwgcmV0cnlVbnRpbCwgewogICAgICBueDogdHJ1ZSwKICAgICAgcHg6IHNhZmVNcywKICAgIH0pOwoKICAgIGlmIChyZXRyaWVkKSB7CiAgICAgIHJldHVybiB7IGFsbG93ZWQ6IHRydWUsIHJlbWFpbmluZ01zOiAwIH07CiAgICB9CiAgfQoKICByZXR1cm4gewogICAgYWxsb3dlZDogZmFsc2UsCiAgICByZW1haW5pbmdNczogTWF0aC5tYXgoMSwgZXhpc3RpbmcgLSBEYXRlLm5vdygpKSwKICB9Owp9CgpleHBvcnQgZnVuY3Rpb24gY29vbGRvd25LZXkoCiAgdHlwZTogc3RyaW5nLAogIGNoYW5uZWxJZDogc3RyaW5nLAogIHVzZXJJZD86IHN0cmluZwopOiBzdHJpbmcgewogIGlmICh1c2VySWQpIHJldHVybiBgY2Q6JHt0eXBlfToke2NoYW5uZWxJZH06JHt1c2VySWR9YDsKICByZXR1cm4gYGNkOiR7dHlwZX06JHtjaGFubmVsSWR9YDsKfQoKZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFJlbWFpbmluZyh1bnRpbDogbnVtYmVyKTogc3RyaW5nIHsKICBjb25zdCBzZWMgPSBNYXRoLm1heCgwLCBNYXRoLmNlaWwoKHVudGlsIC0gRGF0ZS5ub3coKSkgLyAxMDAwKSk7CiAgaWYgKHNlYyA8IDYwKSByZXR1cm4gYCR7c2VjfXNgOwogIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKHNlYyAvIDYwKTsKICBjb25zdCBzZWNvbmRzID0gc2VjICUgNjA7CiAgcmV0dXJuIHNlY29uZHMgPiAwID8gYCR7bWludXRlc31tICR7c2Vjb25kc31zYCA6IGAke21pbnV0ZXN9bWA7Cn0K"
  },
  {
    "path": "src/lib/cooldowns.ts",
    "base64": "aW1wb3J0IHsgUE9USU9OX0NPT0xET1dOX1RJRVJTIH0gZnJvbSAiLi9kYXRhIjsKCmV4cG9ydCBmdW5jdGlvbiBnZXRQb3Rpb25Db29sZG93blNlY29uZHMobHVjazogbnVtYmVyKTogbnVtYmVyIHsKICBmb3IgKGNvbnN0IHRpZXIgb2YgUE9USU9OX0NPT0xET1dOX1RJRVJTKSB7CiAgICBpZiAodGllci5tYXhMdWNrID09PSBudWxsIHx8IGx1Y2sgPD0gdGllci5tYXhMdWNrKSB7CiAgICAgIHJldHVybiB0aWVyLnNlY29uZHM7CiAgICB9CiAgfQoKICByZXR1cm4gUE9USU9OX0NPT0xET1dOX1RJRVJTWwogICAgUE9USU9OX0NPT0xET1dOX1RJRVJTLmxlbmd0aCAtIDEKICBdLnNlY29uZHM7Cn0KCmV4cG9ydCBjb25zdCBST0xMX0NPT0xET1dOX01TID0gMTAwMDA7CgpleHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tDb29sZG93bigKICBrZXk6IHN0cmluZywKICBjb29sZG93bk1zOiBudW1iZXIKKTogUHJvbWlzZTx7IGFsbG93ZWQ6IGJvb2xlYW47IHJlbWFpbmluZ01zOiBudW1iZXIgfT4gewogIGNvbnN0IHsgZ2V0Q29vbGRvd24gfSA9IGF3YWl0IGltcG9ydCgiLi9zdGF0ZSIpOwogIGNvbnN0IHVudGlsID0gYXdhaXQgZ2V0Q29vbGRvd24oa2V5KTsKICBjb25zdCBub3cgPSBEYXRlLm5vdygpOwoKICBpZiAodW50aWwgPiBub3cpIHsKICAgIHJldHVybiB7IGFsbG93ZWQ6IGZhbHNlLCByZW1haW5pbmdNczogdW50aWwgLSBub3cgfTsKICB9CgogIHJldHVybiB7IGFsbG93ZWQ6IHRydWUsIHJlbWFpbmluZ01zOiAwIH07Cn0KCmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhcHBseUNvb2xkb3duKAogIGtleTogc3RyaW5nLAogIGNvb2xkb3duTXM6IG51bWJlcgopOiBQcm9taXNlPHZvaWQ+IHsKICBjb25zdCB7IHNldENvb2xkb3duIH0gPSBhd2FpdCBpbXBvcnQoIi4vc3RhdGUiKTsKICBhd2FpdCBzZXRDb29sZG93bihrZXksIERhdGUubm93KCkgKyBjb29sZG93bk1zKTsKfQoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFjcXVpcmVDb29sZG93bigKICBrZXk6IHN0cmluZywKICBjb29sZG93bk1zOiBudW1iZXIKKTogUHJvbWlzZTx7IGFsbG93ZWQ6IGJvb2xlYW47IHJlbWFpbmluZ01zOiBudW1iZXIgfT4gewogIGNvbnN0IHN0YXRlID0gYXdhaXQgaW1wb3J0KCIuL3N0YXRlIik7CiAgcmV0dXJuIHN0YXRlLmFjcXVpcmVDb29sZG93bihrZXksIGNvb2xkb3duTXMpOwp9Cg=="
  }
];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  const file = absolute(relativePath);
  if (!fs.existsSync(file)) fail(`Missing required file: ${relativePath}`);

  // Git for Windows may check TypeScript files out with CRLF. Normalize only
  // inside the patcher so anchors work identically on Windows, macOS and Linux.
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function write(relativePath, content) {
  const file = absolute(relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  if (fs.existsSync(file)) {
    const backup = `${file}.bak.${STAMP}`;
    fs.copyFileSync(file, backup);
    console.log(`🧯 Backup: ${path.relative(ROOT, backup)}`);
  }

  fs.writeFileSync(file, content, "utf8");
  console.log(`✅ Wrote ${relativePath}`);
}

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) {
    fail(`${label}: expected exactly one match, found ${count}.`);
  }
  return source.replace(search, replacement);
}

function replaceRegexOnce(source, regex, replacement, label) {
  if (!regex.test(source)) {
    fail(`${label}: patch anchor was not found.`);
  }
  regex.lastIndex = 0;
  return source.replace(regex, replacement);
}

function patchFile(relativePath, transform) {
  const original = read(relativePath);
  const updated = transform(original);

  if (updated === original) {
    console.log(`ℹ️ No changes needed: ${relativePath}`);
    return;
  }

  write(relativePath, updated);
}

for (const entry of FULL_FILES) {
  write(entry.path, Buffer.from(entry.base64, "base64").toString("utf8"));
}

/* -------------------------------------------------------------------------- */
/* Discord bridge: one batched link lookup + bounded warm cache                */
/* -------------------------------------------------------------------------- */

patchFile("src/lib/discord-command-bridge.ts", (source) => {
  if (source.includes("const DISCORD_LINK_CACHE_TTL_MS")) return source;

  return replaceRegexOnce(
    source,
    /let redis: Redis \| null \| undefined;[\s\S]*?\nexport function formatDiscordTwitchLink\(/,
`let redis: Redis | null | undefined;

const DISCORD_LINK_CACHE_TTL_MS = 5 * 60 * 1000;
const DISCORD_LINK_NEGATIVE_TTL_MS = 30 * 1000;
const DISCORD_LINK_CACHE_MAX = 2000;

const DISCORD_LINK_CACHE = new Map<
  string,
  {
    expiresAt: number;
    value: DiscordTwitchLink | null;
  }
>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function scopedLinkKey(
  guildId: string | undefined | null,
  discordUserId: string
): string {
  const scope = String(guildId ?? "").trim() || "global";
  return \`discord:twitch-link:\${scope}:\${discordUserId}\`;
}

function globalLinkKey(discordUserId: string): string {
  return \`discord:twitch-link:global:\${discordUserId}\`;
}

function cleanDiscordId(raw: string): string {
  return raw.trim().replace(/[^0-9]/g, "");
}

function cleanTwitchId(raw: string): string {
  return raw.trim().replace(/[^0-9]/g, "");
}

function cleanTwitchUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function linkCandidateKeys(
  guildId: string | undefined | null,
  discordUserId: string
): string[] {
  const keys = [
    globalLinkKey(discordUserId),
    scopedLinkKey(guildId, discordUserId),
  ];

  const configuredGuild =
    String(process.env.DISCORD_GUILD_ID ?? "").trim();

  if (configuredGuild) {
    keys.push(scopedLinkKey(configuredGuild, discordUserId));
  }

  return [...new Set(keys)];
}

function pruneDiscordLinkCache(now = Date.now()): void {
  for (const [key, entry] of DISCORD_LINK_CACHE) {
    if (entry.expiresAt <= now) DISCORD_LINK_CACHE.delete(key);
  }

  while (DISCORD_LINK_CACHE.size > DISCORD_LINK_CACHE_MAX) {
    const oldest = DISCORD_LINK_CACHE.keys().next().value;
    if (!oldest) break;
    DISCORD_LINK_CACHE.delete(oldest);
  }
}

function cacheDiscordLink(
  discordUserId: string,
  value: DiscordTwitchLink | null
): void {
  DISCORD_LINK_CACHE.set(discordUserId, {
    value,
    expiresAt:
      Date.now() +
      (value
        ? DISCORD_LINK_CACHE_TTL_MS
        : DISCORD_LINK_NEGATIVE_TTL_MS),
  });
  pruneDiscordLinkCache();
}

export async function getDiscordTwitchLink(
  guildId: string | undefined | null,
  discordUserId: string
): Promise<DiscordTwitchLink | null> {
  const r = getRedis();
  const cleanDiscord = cleanDiscordId(discordUserId);

  if (!r || !cleanDiscord) return null;

  const cached = DISCORD_LINK_CACHE.get(cleanDiscord);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const keys = linkCandidateKeys(guildId, cleanDiscord);
  const links = (await r.mget(...keys)) as Array<
    DiscordTwitchLink | null
  >;
  const index = links.findIndex(Boolean);
  const found = index >= 0 ? links[index] : null;

  if (!found) {
    cacheDiscordLink(cleanDiscord, null);
    return null;
  }

  const portableLink: DiscordTwitchLink = {
    ...found,
    guildId: "global",
    discordUserId: cleanDiscord,
  };

  const globalKey = globalLinkKey(cleanDiscord);

  if (keys[index] !== globalKey) {
    await r.set(globalKey, portableLink);
  }

  cacheDiscordLink(cleanDiscord, portableLink);
  return portableLink;
}

export async function setDiscordTwitchLink(input: {
  guildId?: string | null;
  discordUserId: string;
  twitchUserId: string;
  twitchUsername: string;
  twitchDisplayName?: string;
  linkedByDiscordUserId: string;
}): Promise<DiscordTwitchLink> {
  const r = getRedis();
  if (!r) throw new Error("Redis is not connected.");

  const discordUserId = cleanDiscordId(input.discordUserId);
  const twitchUserId = cleanTwitchId(input.twitchUserId);
  const twitchUsername = cleanTwitchUsername(input.twitchUsername);

  if (!discordUserId) throw new Error("Enter a valid Discord user.");
  if (!twitchUserId) throw new Error("Enter the numeric Twitch user ID.");
  if (!twitchUsername) throw new Error("Enter the Twitch username.");

  const link: DiscordTwitchLink = {
    guildId: "global",
    discordUserId,
    twitchUserId,
    twitchUsername,
    twitchDisplayName:
      input.twitchDisplayName?.trim() || input.twitchUsername.trim(),
    linkedAt: Date.now(),
    linkedByDiscordUserId: cleanDiscordId(
      input.linkedByDiscordUserId
    ),
  };

  await r.set(globalLinkKey(discordUserId), link);
  cacheDiscordLink(discordUserId, link);
  return link;
}

export async function removeDiscordTwitchLink(
  guildId: string | undefined | null,
  discordUserId: string
): Promise<boolean> {
  const r = getRedis();
  const cleanDiscord = cleanDiscordId(discordUserId);

  if (!r || !cleanDiscord) return false;

  const removed = await r.del(
    ...linkCandidateKeys(guildId, cleanDiscord)
  );

  DISCORD_LINK_CACHE.delete(cleanDiscord);
  return Number(removed) > 0;
}

export function formatDiscordTwitchLink(`,
    "Optimize Discord Twitch-link storage"
  );
});

/* -------------------------------------------------------------------------- */
/* Inventory: rolls do not check username grant mailboxes                      */
/* -------------------------------------------------------------------------- */

patchFile("src/lib/inventory.ts", (source) => {
  if (source.includes("claimPendingGrants?: boolean")) return source;

  source = replaceOnce(
    source,
`function removeExpiredBuffs(inventory: ViewerInventory): void {
  const now = Date.now();

  inventory.activeBuffs = inventory.activeBuffs.filter(
    (buff) => !buff.expiresAt || buff.expiresAt > now
  );
}`,
`function removeExpiredBuffs(inventory: ViewerInventory): boolean {
  const now = Date.now();
  const before = inventory.activeBuffs.length;

  inventory.activeBuffs = inventory.activeBuffs.filter(
    (buff) => !buff.expiresAt || buff.expiresAt > now
  );

  return inventory.activeBuffs.length !== before;
}`,
    "Make expired-buff cleanup report changes"
  );

  source = replaceOnce(
    source,
`export async function getViewerInventory(
  channelId: string,
  user: NightbotUser | null
): Promise<ViewerInventory> {`,
`export async function getViewerInventory(
  channelId: string,
  user: NightbotUser | null,
  options?: {
    claimPendingGrants?: boolean;
  }
): Promise<ViewerInventory> {`,
    "Add inventory load options"
  );

  source = replaceOnce(
    source,
`  const inventory = normalizeInventory(data, channelId, userId, displayName);
  removeExpiredBuffs(inventory);

  const claimed = await claimPendingGrants(inventory, user);

  if (claimed) {
    await setViewerInventory(inventory);
  }`,
`  const inventory = normalizeInventory(data, channelId, userId, displayName);
  const expiredChanged = removeExpiredBuffs(inventory);
  const claimed =
    options?.claimPendingGrants === false
      ? false
      : await claimPendingGrants(inventory, user);

  if (claimed || expiredChanged) {
    await setViewerInventory(inventory);
  }`,
    "Skip optional pending grants"
  );

  source = replaceOnce(
    source,
`  const inventory = await getViewerInventory(options.channelId, options.user);
  const rolls = Math.max(0, Math.floor(options.rolls));`,
`  const inventory = await getViewerInventory(
    options.channelId,
    options.user,
    { claimPendingGrants: false }
  );
  const rolls = Math.max(0, Math.floor(options.rolls));`,
    "Use fast inventory load during rolls"
  );

  source = replaceOnce(
    source,
`  const originalBuffs = JSON.stringify(inventory.activeBuffs);
  const effects: RollTokenEffect[] = [];`,
`  const effects: RollTokenEffect[] = [];`,
    "Remove JSON snapshot"
  );

  source = replaceOnce(
    source,
`  if (JSON.stringify(activeBuffs) !== originalBuffs) {
    await setViewerInventory(inventory);
  }`,
`  const consumed = effects.some((effect) =>
    effect.used.some((buff) => buff.consumeOnRoll)
  );

  if (consumed) {
    await setViewerInventory(inventory);
  }`,
    "Save inventory only when consumables changed"
  );

  return source;
});

/* -------------------------------------------------------------------------- */
/* Profile index v2 + snapshot-aware roll recording                            */
/* -------------------------------------------------------------------------- */

patchFile("src/lib/profile.ts", (source) => {
  if (
    source.includes("const PROFILE_INDEX_VERSION = 2;") &&
    source.includes("getIndexedProfileKeys") &&
    source.includes("existingProfile?: ViewerProfile")
  ) {
    return source;
  }

  if (!source.includes("indexVersion: number;")) {
    source = replaceOnce(
      source,
`  displayName: string;

  rolls: number;`,
`  displayName: string;
  indexVersion: number;

  rolls: number;`,
      "Add profile index version"
    );

    source = replaceOnce(
      source,
`    displayName,

    rolls: 0,`,
`    displayName,
    indexVersion: 0,

    rolls: 0,`,
      "Initialize profile index version"
    );

    source = replaceOnce(
      source,
`    displayName: displayName || input.displayName || base.displayName,

    rolls: input.rolls ?? 0,`,
`    displayName: displayName || input.displayName || base.displayName,
    indexVersion: Math.max(
      0,
      Math.floor(input.indexVersion ?? 0)
    ),

    rolls: input.rolls ?? 0,`,
      "Normalize profile index version"
    );
  }

  source = replaceRegexOnce(
    source,
    /const PROFILE_REGISTRATION_CACHE = new Set<string>\(\);[\s\S]*?\nexport async function getViewerProfile\(/,
`const PROFILE_INDEX_VERSION = 2;
const PROFILE_REGISTRATION_CACHE = new Set<string>();

function profileIndexSetKey(channelId: string): string {
  return \`profiles:\${channelId}:members:v2\`;
}

async function registerProfileKey(
  channelId: string,
  key: string
): Promise<void> {
  const cacheKey = \`\${channelId}:\${key}\`;
  if (PROFILE_REGISTRATION_CACHE.has(cacheKey)) return;

  const r = getRedis();
  if (!r) return;

  await r.sadd(profileIndexSetKey(channelId), key);
  PROFILE_REGISTRATION_CACHE.add(cacheKey);

  if (PROFILE_REGISTRATION_CACHE.size > 5000) {
    PROFILE_REGISTRATION_CACHE.clear();
    PROFILE_REGISTRATION_CACHE.add(cacheKey);
  }
}

async function getIndexedProfileKeys(
  channelId: string
): Promise<string[]> {
  const r = getRedis();
  if (!r) return [];

  const setKey = profileIndexSetKey(channelId);
  const current = (await r.smembers(setKey)) as string[];

  if (current.length > 0) return current;

  const legacy =
    (await r.get<string[]>(profileIndexKey(channelId))) ?? [];

  if (legacy.length > 0) {
    for (let index = 0; index < legacy.length; index += 500) {
      await r.sadd(setKey, ...legacy.slice(index, index + 500));
    }
  }

  return legacy;
}

export async function getViewerProfile(`,
    "Install profile set index"
  );

  source = replaceOnce(
    source,
`  if (user) {
    if (!data) {
      await r.set(key, profile);
    }

    await registerProfileKey(channelId, key);
  }`,
`  if (user) {
    let shouldSave = !data;

    if (profile.indexVersion < PROFILE_INDEX_VERSION) {
      await registerProfileKey(channelId, key);
      profile.indexVersion = PROFILE_INDEX_VERSION;
      shouldSave = true;
    }

    if (shouldSave) {
      await r.set(key, profile);
    }
  }`,
    "Register profile only once persistently"
  );

  source = replaceRegexOnce(
    source,
    /export async function setViewerProfile\([\s\S]*?\n}\n\nexport function getProfileTierId\(/,
`export async function setViewerProfile(
  profile: ViewerProfile,
  options?: { register?: boolean }
): Promise<void> {
  const r = getRedis();
  if (!r) return;

  const key = profileKey(profile.channelId, profile.userId);
  profile.updatedAt = Date.now();

  if (
    options?.register !== false &&
    profile.indexVersion < PROFILE_INDEX_VERSION
  ) {
    await registerProfileKey(profile.channelId, key);
    profile.indexVersion = PROFILE_INDEX_VERSION;
  }

  await r.set(key, profile);
}

export function getProfileTierId(`,
    "Optimize profile save registration"
  );

  source = replaceOnce(
    source,
`  source: "roll" | "token" | "potion"
): Promise<ViewerProfile> {
  const profile = await getViewerProfile(channelId, user);`,
`  source: "roll" | "token" | "potion",
  existingProfile?: ViewerProfile
): Promise<ViewerProfile> {
  const profile =
    existingProfile ?? (await getViewerProfile(channelId, user));`,
    "Reuse preloaded profile"
  );

  {
    const listStart = source.indexOf(
      "export async function listViewerProfiles("
    );
    const resetStart = source.indexOf(
      "export async function resetViewerProfiles(",
      listStart
    );

    if (listStart < 0 || resetStart < 0) {
      fail("Read profile set index: profile list function was not found.");
    }

    const before = source.slice(0, listStart);
    const listSection = source.slice(listStart, resetStart);
    const after = source.slice(resetStart);
    const oldIndexRead = `  const indexKey = profileIndexKey(channelId);
  const keys = (await r.get<string[]>(indexKey)) ?? [];`;
    const count = listSection.split(oldIndexRead).length - 1;

    if (count !== 1) {
      fail(
        `Read profile set index: expected one list index read, found ${count}.`
      );
    }

    source =
      before +
      listSection.replace(
        oldIndexRead,
        `  const keys = await getIndexedProfileKeys(channelId);`
      ) +
      after;
  }

  source = replaceOnce(
    source,
`  const indexKey = profileIndexKey(channelId);
  const keys = (await r.get<string[]>(indexKey)) ?? [];

  if (keys.length > 0) {
    await r.del(...keys);
  }

  await r.del(indexKey);`,
`  const indexKey = profileIndexKey(channelId);
  const setKey = profileIndexSetKey(channelId);
  const keys = await getIndexedProfileKeys(channelId);

  if (keys.length > 0) {
    await r.del(...keys);
  }

  await r.del(indexKey, setKey);`,
    "Reset both profile indexes"
  );

  return source;
});

/* -------------------------------------------------------------------------- */
/* Player reset understands profile index v2                                   */
/* -------------------------------------------------------------------------- */

patchFile("src/pages/api/player-reset.ts", (source) => {
  if (source.includes("profileIndexSet")) return source;

  source = replaceOnce(
    source,
`  const indexKey = \`profiles:\${channelId}:keys\`;
  const indexedKeys = (await r.get<string[]>(indexKey)) ?? [];
  const values = await mgetValues(r, indexedKeys.slice(0, 5000));`,
`  const indexKey = \`profiles:\${channelId}:keys\`;
  const indexSetKey = \`profiles:\${channelId}:members:v2\`;
  const setKeys = (await r.smembers(indexSetKey)) as string[];
  const indexedKeys =
    setKeys.length > 0
      ? setKeys
      : (await r.get<string[]>(indexKey)) ?? [];
  const values = await mgetValues(r, indexedKeys.slice(0, 5000));`,
    "Resolve players from v2 index"
  );

  source = replaceOnce(
    source,
`    profileIndex: \`profiles:\${channelId}:keys\`,
    luck:`,
`    profileIndex: \`profiles:\${channelId}:keys\`,
    profileIndexSet: \`profiles:\${channelId}:members:v2\`,
    luck:`,
    "Add v2 index key"
  );

  source = replaceOnce(
    source,
`  const profileIndexMatches = (
    (valueByKey.get(keys.profileIndex) as string[] | null) ?? []
  ).filter(
    (entry) =>
      entry === target.profileKey ||
      entry.endsWith(\`:\${target.userId}\`)
  ).length;`,
`  const legacyProfileIndexMatches = (
    (valueByKey.get(keys.profileIndex) as string[] | null) ?? []
  ).filter(
    (entry) =>
      entry === target.profileKey ||
      entry.endsWith(\`:\${target.userId}\`)
  ).length;

  const profileIndexSetMatch = await r.sismember(
    keys.profileIndexSet,
    target.profileKey
  );

  const profileIndexMatches =
    legacyProfileIndexMatches +
    (profileIndexSetMatch ? 1 : 0);`,
    "Count both profile indexes"
  );

  source = replaceOnce(
    source,
`      key = keys.profileIndex;
      kind = "shared";
      matches = ((valueByKey.get(key) as string[] | null) ?? []).filter(
        (entry) => entry === target.profileKey
      ).length;`,
`      key = \`\${keys.profileIndex} + \${keys.profileIndexSet}\`;
      kind = "shared";
      matches = profileIndexMatches;`,
    "Preview both profile indexes"
  );

  source = replaceRegexOnce(
    source,
    /async function removeProfileIndex\([\s\S]*?\n}\n\nasync function resetPeriodLeaderboards\(/,
`async function removeProfileIndex(
  r: Redis,
  target: TargetPlayer
): Promise<number> {
  const key = \`profiles:\${target.channelId}:keys\`;
  const setKey = \`profiles:\${target.channelId}:members:v2\`;
  const list = (await r.get<string[]>(key)) ?? [];
  const values = await mgetValues(r, list);

  const next = list.filter((entry, index) => {
    const profile = values[index] as Record<string, any> | null;
    const entryUserId = cleanId(entry.split(":").pop());
    const profileUserId = cleanId(profile?.userId);
    const profileUsername = normalizeUsername(profile?.displayName);

    return !(
      entry === target.profileKey ||
      entryUserId === target.userId ||
      profileUserId === target.userId ||
      (Boolean(target.username) &&
        profileUsername === target.username)
    );
  });

  let removed = list.length - next.length;

  if (removed > 0) {
    await r.set(key, next);
  }

  removed += Number(await r.srem(setKey, target.profileKey));
  return removed;
}

async function resetPeriodLeaderboards(`,
    "Remove from both profile indexes"
  );

  return source;
});

/* -------------------------------------------------------------------------- */
/* Achievement snapshot reuse                                                   */
/* -------------------------------------------------------------------------- */

patchFile("src/lib/global-stats.ts", (source) => {
  if (
    source.includes("export async function getAchievementSnapshot") &&
    source.includes("existingState?: AchievementState")
  ) {
    return source;
  }

  if (!source.includes("getAchievementSnapshot")) {
    source = replaceOnce(
      source,
`export async function setAchievementState(
  state: AchievementState
): Promise<void> {`,
`export async function getAchievementSnapshot(): Promise<{
  state: AchievementState;
  bonuses: ReturnType<typeof calculateAchievementBonuses>;
}> {
  const state = await getAchievementState();
  return {
    state,
    bonuses: calculateAchievementBonuses(state),
  };
}

export async function setAchievementState(
  state: AchievementState
): Promise<void> {`,
      "Add achievement snapshot"
    );
  }

  source = replaceOnce(
    source,
`export async function recordAuraRolls(
  rolls: Array<{ aura: AuraDef; effectiveRarity: number }>
): Promise<AchievementDef[]> {
  const state = await getAchievementState();`,
`export async function recordAuraRolls(
  rolls: Array<{ aura: AuraDef; effectiveRarity: number }>,
  existingState?: AchievementState
): Promise<AchievementDef[]> {
  const state = existingState ?? (await getAchievementState());`,
    "Reuse achievement state"
  );

  source = replaceOnce(
    source,
`export async function getAchievementBonuses() {
  const state = await getAchievementState();
  return calculateAchievementBonuses(state);
}`,
`export async function getAchievementBonuses() {
  return (await getAchievementSnapshot()).bonuses;
}`,
    "Reuse achievement snapshot helper"
  );

  return source;
});

/* -------------------------------------------------------------------------- */
/* Core: one MSET and snapshot-aware roll recording                            */
/* -------------------------------------------------------------------------- */

patchFile("src/lib/core-system.ts", (source) => {
  if (
    source.includes("const GLOBAL_QUEST_CACHE_MS") &&
    source.includes("getViewerCoreLuckSnapshot") &&
    source.includes("options?.state") &&
    source.includes("[channelActivityKey(state.channelId)]: now")
  ) {
    return source;
  }

  if (!source.includes("GLOBAL_QUEST_CACHE_MS")) {
    source = replaceOnce(
      source,
`const GLOBAL_QUEST_COMPLETIONS_KEY = "mega:gquest-completions";

const MECHANICAL_SCRAP_ROLL_INTERVAL = 5;`,
`const GLOBAL_QUEST_COMPLETIONS_KEY = "mega:gquest-completions";
const GLOBAL_QUEST_CACHE_MS = 15 * 1000;

let globalQuestCache:
  | {
      expiresAt: number;
      value: number;
    }
  | undefined;

const MECHANICAL_SCRAP_ROLL_INTERVAL = 5;`,
      "Add global quest cache"
    );

    source = replaceOnce(
      source,
`async function getGlobalQuestCompletions(): Promise<number> {
  const r = getRedis();
  if (!r) return 0;
  const value = await r.get<number>(GLOBAL_QUEST_COMPLETIONS_KEY);
  return Math.max(0, Math.floor(value ?? 0));
}`,
`async function getGlobalQuestCompletions(): Promise<number> {
  const now = Date.now();

  if (globalQuestCache && globalQuestCache.expiresAt > now) {
    return globalQuestCache.value;
  }

  const r = getRedis();
  if (!r) return 0;

  const value = Math.max(
    0,
    Math.floor(
      (await r.get<number>(GLOBAL_QUEST_COMPLETIONS_KEY)) ?? 0
    )
  );

  globalQuestCache = {
    value,
    expiresAt: now + GLOBAL_QUEST_CACHE_MS,
  };

  return value;
}`,
      "Cache global quest count"
    );
  }

  source = replaceOnce(
    source,
`  await r.set(stateKey(state.channelId, state.userId), state);
  await r.set(channelActivityKey(state.channelId), now);`,
`  await r.mset({
    [stateKey(state.channelId, state.userId)]: state,
    [channelActivityKey(state.channelId)]: now,
  });`,
    "Batch Core writes"
  );

  source = replaceOnce(
    source,
`export async function recordCoreRolls(
  channelId: string,
  user: NightbotUser | null,
  rolls: RollHitForCore[]
): Promise<CoreSystemState> {
  const state = await getCoreState(channelId, user);
  const globalRolls = await getGlobalRolls();
  const profile = user ? await getViewerProfile(channelId, user) : null;
  const globalQuestCompletions = await getGlobalQuestCompletions();
  const materialDuplicateChance = getMaterialComponentDuplicateChance(state, globalRolls);
  const materialMultiplier = materialDropMultiplier(state, profile?.level ?? 0, globalQuestCompletions);`,
`export async function recordCoreRolls(
  channelId: string,
  user: NightbotUser | null,
  rolls: RollHitForCore[],
  options?: {
    state?: CoreSystemState;
    globalRolls?: number;
    profileLevel?: number;
    globalQuestCompletions?: number;
  }
): Promise<CoreSystemState> {
  const state =
    options?.state ?? (await getCoreState(channelId, user));

  const [globalRolls, profileLevel, globalQuestCompletions] =
    await Promise.all([
      options?.globalRolls !== undefined
        ? Promise.resolve(options.globalRolls)
        : getGlobalRolls(),
      options?.profileLevel !== undefined
        ? Promise.resolve(options.profileLevel)
        : user
        ? getViewerProfile(channelId, user).then(
            (profile) => profile.level
          )
        : Promise.resolve(0),
      options?.globalQuestCompletions !== undefined
        ? Promise.resolve(options.globalQuestCompletions)
        : getGlobalQuestCompletions(),
    ]);

  const materialDuplicateChance =
    getMaterialComponentDuplicateChance(state, globalRolls);
  const materialMultiplier = materialDropMultiplier(
    state,
    profileLevel,
    globalQuestCompletions
  );`,
    "Reuse Core roll snapshots"
  );

  source = replaceRegexOnce(
    source,
    /export async function getViewerCoreLuck\([\s\S]*?\n}\n\nexport async function craftByIdAmount\(/,
`export async function getViewerCoreLuckSnapshot(
  channelId: string,
  user: NightbotUser | null
): Promise<{
  state: CoreSystemState;
  luck: {
    bonusPercent: number;
    multiplier: number;
    label: string;
  };
}> {
  const state = await touchCoreState(channelId, user);
  const bonusPercent = getCoreLuckBonusPercent(state);

  return {
    state,
    luck: {
      bonusPercent,
      multiplier: 1 + bonusPercent / 100,
      label: \`\${formatPercent(bonusPercent)} luck\`,
    },
  };
}

export async function getViewerCoreLuck(
  channelId: string,
  user: NightbotUser | null
): Promise<{
  bonusPercent: number;
  multiplier: number;
  label: string;
}> {
  return (await getViewerCoreLuckSnapshot(channelId, user)).luck;
}

export async function craftByIdAmount(`,
    "Add Core luck snapshot"
  );

  return source;
});

/* -------------------------------------------------------------------------- */
/* Roll hot path: reuse snapshots and atomic cooldown                          */
/* -------------------------------------------------------------------------- */

patchFile("src/pages/api/roll.ts", (source) => {
  if (
    source.includes("achievementSnapshot") &&
    source.includes("coreSnapshot") &&
    source.includes("acquireCooldown") &&
    source.includes("preloadedViewerProfile ?? undefined")
  ) {
    return source;
  }

  source = source.replace(
`  getAchievementBonuses,
  recordAuraRolls,`,
`  getAchievementSnapshot,
  recordAuraRolls,`
  );

  source = source.replace(
`  applyCooldown,
  checkCooldown,
  ROLL_COOLDOWN_MS,`,
`  acquireCooldown,
  ROLL_COOLDOWN_MS,`
  );

  source = source.replace(
`import { getViewerCoreLuck, recordCoreRolls } from "@/lib/core-system";`,
`import {
  getViewerCoreLuckSnapshot,
  recordCoreRolls,
} from "@/lib/core-system";`
  );

  source = replaceOnce(
    source,
`    broadcaster || !user
      ? Promise.resolve(null)
      : getViewerProfile(channelId, user),`,
`    user
      ? getViewerProfile(channelId, user)
      : Promise.resolve(null),`,
    "Always preload persisted user profile"
  );

  source = replaceOnce(
    source,
`  const [
    achievementBonuses,
    coreLuck,
    serverLuck,
    megaLuck,
  ] = await Promise.all([
    getAchievementBonuses(),
    getViewerCoreLuck(channelId, user),
    getServerLuckMultiplier(channelId),
    getMegaLuckMultiplier(channelId),
  ]);`,
`  const [
    achievementSnapshot,
    coreSnapshot,
    serverLuck,
    megaLuck,
  ] = await Promise.all([
    getAchievementSnapshot(),
    getViewerCoreLuckSnapshot(channelId, user),
    getServerLuckMultiplier(channelId),
    getMegaLuckMultiplier(channelId),
  ]);

  const achievementBonuses = achievementSnapshot.bonuses;
  const coreLuck = coreSnapshot.luck;`,
    "Preload roll snapshots"
  );

  source = replaceOnce(
    source,
`    const cd = await checkCooldown(key, cooldownMs);

    if (!cd.allowed) {
      return text(res, \`Roll cooldown: \${formatRemaining(Date.now() + cd.remainingMs)}\`);
    }

    await applyCooldown(key, cooldownMs);`,
`    const cooldown = await acquireCooldown(key, cooldownMs);

    if (!cooldown.allowed) {
      return text(
        res,
        \`Roll cooldown: \${formatRemaining(
          Date.now() + cooldown.remainingMs
        )}\`
      );
    }`,
    "Use atomic cooldown"
  );

  source = replaceOnce(
    source,
`        recordViewerRolls(
          channelId,
          user,
          results,
          oneTimeTokenAssisted ? "token" : "roll"
        ),
        recordCoreRolls(channelId, user, results),
        recordAuraRolls(results),`,
`        recordViewerRolls(
          channelId,
          user,
          results,
          oneTimeTokenAssisted ? "token" : "roll",
          preloadedViewerProfile ?? undefined
        ),
        recordCoreRolls(channelId, user, results, {
          state: coreSnapshot.state,
          globalRolls: globalRollsAfter,
          profileLevel: preloadedViewerProfile?.level,
        }),
        recordAuraRolls(
          results,
          achievementSnapshot.state
        ),`,
    "Reuse persistence snapshots"
  );

  return source;
});

/* -------------------------------------------------------------------------- */
/* Social boosts: persisted summary + warm cache                               */
/* -------------------------------------------------------------------------- */

patchFile("src/lib/social-system.ts", (source) => {
  if (source.includes("boostSummaryKey")) return source;

  source = replaceOnce(
    source,
`interface ServerBoost {
  id: string;
  name: string;
  percent: number;
  source: string;
  createdAt: number;
  expiresAt: number;
}`,
`interface ServerBoost {
  id: string;
  name: string;
  percent: number;
  source: string;
  createdAt: number;
  expiresAt: number;
}

interface ServerBoostSummary {
  percent: number;
  validUntil: number;
  updatedAt: number;
}`,
    "Add boost summary type"
  );

  source = replaceOnce(
    source,
`function boostKey(channelId: string): string { return \`social:boosts:\${channelId}\`; }`,
`function boostKey(channelId: string): string { return \`social:boosts:\${channelId}\`; }
function boostSummaryKey(channelId: string): string { return \`social:boost-summary:\${channelId}\`; }

const BOOST_SUMMARY_CACHE = new Map<
  string,
  {
    expiresAt: number;
    value: ServerBoostSummary;
  }
>();

function summarizeBoosts(boosts: ServerBoost[]): ServerBoostSummary {
  const now = Date.now();
  const active = boosts.filter((boost) => boost.expiresAt > now);
  const percent = Math.min(
    250,
    active.reduce(
      (sum, boost) => sum + Math.max(0, boost.percent),
      0
    )
  );
  const nextExpiry =
    active.length > 0
      ? Math.min(...active.map((boost) => boost.expiresAt))
      : now + 30 * 1000;

  return {
    percent,
    validUntil: nextExpiry,
    updatedAt: now,
  };
}

function cacheBoostSummary(
  channelId: string,
  summary: ServerBoostSummary
): void {
  BOOST_SUMMARY_CACHE.set(channelId, {
    value: summary,
    expiresAt: Math.min(
      summary.validUntil,
      Date.now() + 15 * 1000
    ),
  });

  if (BOOST_SUMMARY_CACHE.size > 500) {
    BOOST_SUMMARY_CACHE.clear();
    BOOST_SUMMARY_CACHE.set(channelId, {
      value: summary,
      expiresAt: Math.min(
        summary.validUntil,
        Date.now() + 15 * 1000
      ),
    });
  }
}`,
    "Add persisted boost summary"
  );

  source = replaceOnce(
    source,
`async function setBoosts(channelId: string, boosts: ServerBoost[]): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(boostKey(channelId), boosts.filter((boost) => boost.expiresAt > Date.now()).slice(0, 12));
}`,
`async function setBoosts(
  channelId: string,
  boosts: ServerBoost[]
): Promise<void> {
  const r = getRedis();
  if (!r) return;

  const active = boosts
    .filter((boost) => boost.expiresAt > Date.now())
    .slice(0, 12);
  const summary = summarizeBoosts(active);

  await r.mset({
    [boostKey(channelId)]: active,
    [boostSummaryKey(channelId)]: summary,
  });

  cacheBoostSummary(channelId, summary);
}`,
    "Batch boost storage"
  );

  source = replaceOnce(
    source,
`export async function getServerLuckMultiplier(channelId: string): Promise<{ percent: number; multiplier: number; label: string }> {
  const boosts = await getBoosts(channelId);
  const percent = Math.min(250, boosts.reduce((sum, boost) => sum + Math.max(0, boost.percent), 0));
  return { percent, multiplier: 1 + percent / 100, label: percent > 0 ? \`+\${formatAmount(percent)}% server luck\` : "No server boost" };
}`,
`export async function getServerLuckMultiplier(
  channelId: string
): Promise<{
  percent: number;
  multiplier: number;
  label: string;
}> {
  const now = Date.now();
  const cached = BOOST_SUMMARY_CACHE.get(channelId);

  if (cached && cached.expiresAt > now) {
    const percent = cached.value.percent;
    return {
      percent,
      multiplier: 1 + percent / 100,
      label:
        percent > 0
          ? \`+\${formatAmount(percent)}% server luck\`
          : "No server boost",
    };
  }

  const r = getRedis();
  const stored = r
    ? await r.get<ServerBoostSummary>(boostSummaryKey(channelId))
    : null;

  let summary = stored;

  if (!summary || summary.validUntil <= now) {
    const boosts = await getBoosts(channelId);
    summary = summarizeBoosts(boosts);

    if (r) {
      await r.set(boostSummaryKey(channelId), summary);
    }
  }

  cacheBoostSummary(channelId, summary);
  const percent = summary.percent;

  return {
    percent,
    multiplier: 1 + percent / 100,
    label:
      percent > 0
        ? \`+\${formatAmount(percent)}% server luck\`
        : "No server boost",
  };
}`,
    "Use boost summary on rolls"
  );

  source = replaceOnce(
    source,
`  const boosts = await getBoosts(channelId);
  await setBoosts(channelId, boosts);
  if (boosts.length === 0)`,
`  const boosts = await getBoosts(channelId);
  if (boosts.length === 0)`,
    "Stop writing on boost status reads"
  );

  return source;
});

/* -------------------------------------------------------------------------- */
/* Mega settings/event caches and atomic biome recording                       */
/* -------------------------------------------------------------------------- */

patchFile("src/lib/mega-feature-system.ts", (source) => {
  if (
    source.includes("MEGA_DISCORD_SETTINGS_CACHE") &&
    source.includes("CHANNEL_EVENT_CACHE") &&
    source.includes("const unique = await r.set(dupKey, marker") &&
    source.includes("await r.mset({\n    [firstKey]: firsts")
  ) {
    return source;
  }

  if (!source.includes("MEGA_DISCORD_SETTINGS_CACHE")) {
    source = replaceOnce(
      source,
`let redis: Redis | null = null;
function getRedis(): Redis | null {`,
`let redis: Redis | null = null;

const MEGA_DISCORD_SETTINGS_CACHE = new Map<
  string,
  {
    expiresAt: number;
    value: DiscordSettings;
  }
>();

const CHANNEL_EVENT_CACHE = new Map<
  string,
  {
    expiresAt: number;
    value: ChannelEvent | null;
  }
>();

function getRedis(): Redis | null {`,
      "Add Mega caches"
    );

    source = replaceOnce(
      source,
`export async function getMegaDiscordSettings(channelId: string): Promise<DiscordSettings> {
  const r = getRedis();
  const base = defaultDiscordSettings();
  if (!r) return base;
  const data = await r.get<Partial<DiscordSettings>>(kDiscord(channelId));
  return {
    ...base,
    ...data,
    rareBiomes: Array.isArray(data?.rareBiomes) && data.rareBiomes.length > 0 ? data.rareBiomes.map(norm).filter(Boolean) : base.rareBiomes,
    minAuraRarity: Math.max(1, Number(data?.minAuraRarity ?? base.minAuraRarity)),
    webhookUrl: data?.webhookUrl ?? base.webhookUrl,
  };
}`,
`export async function getMegaDiscordSettings(
  channelId: string
): Promise<DiscordSettings> {
  const cached = MEGA_DISCORD_SETTINGS_CACHE.get(channelId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const r = getRedis();
  const base = defaultDiscordSettings();
  if (!r) return base;

  const data =
    await r.get<Partial<DiscordSettings>>(kDiscord(channelId));
  const value: DiscordSettings = {
    ...base,
    ...data,
    rareBiomes:
      Array.isArray(data?.rareBiomes) &&
      data.rareBiomes.length > 0
        ? data.rareBiomes.map(norm).filter(Boolean)
        : base.rareBiomes,
    minAuraRarity: Math.max(
      1,
      Number(data?.minAuraRarity ?? base.minAuraRarity)
    ),
    webhookUrl: data?.webhookUrl ?? base.webhookUrl,
  };

  MEGA_DISCORD_SETTINGS_CACHE.set(channelId, {
    value,
    expiresAt: Date.now() + 30 * 1000,
  });

  return value;
}`,
      "Cache Discord alert settings"
    );

    source = replaceOnce(
      source,
`  await r.set(kDiscord(channelId), { ...settings, updatedAt: Date.now() });`,
`  const value = { ...settings, updatedAt: Date.now() };
  await r.set(kDiscord(channelId), value);
  MEGA_DISCORD_SETTINGS_CACHE.set(channelId, {
    value,
    expiresAt: Date.now() + 30 * 1000,
  });`,
      "Update Discord settings cache"
    );
  }

  source = replaceRegexOnce(
    source,
    /export async function recordMegaBiome\([\s\S]*?\n}\n\nfunction questsFor\(/,
`export async function recordMegaBiome(options: {
  channelId: string;
  channelName?: string | null;
  biomeId: string;
  timeOfDay?: string | null;
  expiresAt?: number;
}): Promise<void> {
  const r = getRedis();
  if (!r) return;

  const settings = await getMegaDiscordSettings(options.channelId);
  const biomeId = norm(options.biomeId);

  if (!settings.rareBiomes.includes(biomeId)) return;

  const dupKey = \`mega:lastbiome:\${options.channelId}\`;
  const marker = \`\${biomeId}:\${options.expiresAt ?? 0}\`;
  const unique = await r.set(dupKey, marker, {
    nx: true,
    ex: 60 * 60 * 6,
  });

  if (!unique) return;

  const firstKey = kFirsts(options.channelId);
  const recordKey = kRecords(options.channelId);
  const [firstRaw, recordRaw] = (await r.mget(
    firstKey,
    recordKey
  )) as [FirstState | null, RecordsState | null];

  const firsts =
    firstRaw ?? { auras: {}, biomes: {} };
  const records =
    recordRaw ?? {
      totalRarePulls: 0,
      rareBiomes: {},
      updatedAt: Date.now(),
    };

  if (!firsts.biomes[biomeId]) {
    firsts.biomes[biomeId] = {
      biomeId,
      biomeName: titleCase(biomeId),
      channelName:
        norm(options.channelName) || options.channelId,
      createdAt: Date.now(),
    };
  }

  records.rareBiomes[biomeId] =
    (records.rareBiomes[biomeId] ?? 0) + 1;
  records.updatedAt = Date.now();

  await r.mset({
    [firstKey]: firsts,
    [recordKey]: records,
  });

  const channel =
    norm(options.channelName) || options.channelId;

  await postDiscord(options.channelId, {
    embeds: [
      {
        title: "🌍 Rare Biome Spawned!",
        description: \`**\${titleCase(
          biomeId
        )}** spawned in **\${channel}**\`,
        color: 0x2ecc71,
        fields: [
          {
            name: "Biome",
            value: titleCase(biomeId),
            inline: true,
          },
          {
            name: "Time",
            value: options.timeOfDay
              ? titleCase(options.timeOfDay)
              : "Unknown",
            inline: true,
          },
          {
            name: "Twitch Channel",
            value: \`\${channel}\\n\${channelUrl(channel)}\`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

function questsFor(`,
    "Optimize biome recording"
  );

  source = replaceOnce(
    source,
`    await r.set(kEvent(channelId), event);
    return \`🎉 Event started: \${event.name} +\${event.percent}% for \${mins}m.\`;`,
`    await r.set(kEvent(channelId), event);
    CHANNEL_EVENT_CACHE.set(channelId, {
      value: event,
      expiresAt: Math.min(
        event.expiresAt,
        Date.now() + 5000
      ),
    });
    return \`🎉 Event started: \${event.name} +\${event.percent}% for \${mins}m.\`;`,
    "Cache started event"
  );

  source = replaceOnce(
    source,
`    await r.del(kEvent(channelId));
    return "🎉 Channel event stopped.";`,
`    await r.del(kEvent(channelId));
    CHANNEL_EVENT_CACHE.set(channelId, {
      value: null,
      expiresAt: Date.now() + 5000,
    });
    return "🎉 Channel event stopped.";`,
    "Cache stopped event"
  );

  source = replaceOnce(
    source,
`export async function getActiveChannelEvent(channelId: string): Promise<ChannelEvent | null> {
  const r = getRedis();
  if (!r) return null;
  const event = await r.get<ChannelEvent>(kEvent(channelId));
  if (!event || event.expiresAt <= Date.now()) return null;
  return event;
}`,
`export async function getActiveChannelEvent(
  channelId: string
): Promise<ChannelEvent | null> {
  const now = Date.now();
  const cached = CHANNEL_EVENT_CACHE.get(channelId);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const r = getRedis();
  if (!r) return null;

  const stored = await r.get<ChannelEvent>(kEvent(channelId));
  const event =
    stored && stored.expiresAt > now ? stored : null;

  CHANNEL_EVENT_CACHE.set(channelId, {
    value: event,
    expiresAt: event
      ? Math.min(event.expiresAt, now + 5000)
      : now + 5000,
  });

  return event;
}`,
    "Cache channel event luck"
  );

  return source;
});

console.log("");
console.log("✅ Sol's RNG performance overhaul v2 installed/resumed.");
console.log("   • Discord handler bundle slimmed");
console.log("   • Discord links batched and cached");
console.log("   • Atomic cooldown acquisition");
console.log("   • Roll snapshots reused");
console.log("   • Roll inventory skips pending-grant mailboxes");
console.log("   • Profile index v2 auto-migration");
console.log("   • Core writes batched");
console.log("   • Boost summaries denormalized");
console.log("   • Mega event/settings caching");
console.log("   • Rare-biome writes batched");
