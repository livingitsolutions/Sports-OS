import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {AppShell} from "../../src/App";
const organizations=[{organizationId:"org-a",membershipId:"member-a",organizationName:"Alpha Athletics"},{organizationId:"org-b",membershipId:"member-b",organizationName:"Bay League"}];
describe("Organizer Context shell",()=>{
 it("uses safe organization display information for one organization",()=>{const output=renderToStaticMarkup(React.createElement(AppShell,{organizations:organizations.slice(0,1),selectedOrganizationId:"org-a"},"content"));expect(output).toContain("Alpha Athletics");expect(output).not.toContain("Organization context");});
 it("provides a selector for multiple active organizations",()=>{const output=renderToStaticMarkup(React.createElement(AppShell,{organizations,selectedOrganizationId:"org-b"},"content"));expect(output).toContain("Organization context");expect(output).toContain("Alpha Athletics");expect(output).toContain("Bay League");expect(output).toContain('value="org-b" selected=""');});
});
