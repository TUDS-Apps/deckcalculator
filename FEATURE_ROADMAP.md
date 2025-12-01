# TUDS Pro Deck Estimator - Feature Roadmap

**Created:** November 27, 2025
**Last Updated:** December 1, 2025

---

## Priority Tiers

### Tier 1: Sales Acceleration (Immediate Impact)
*Features that directly speed up the sales process and close deals faster.*

| Feature | Description | Impact | Effort | Status |
|---------|-------------|--------|--------|--------|
| **Save/Load Projects** | Save designs locally or to cloud, reload for follow-up calls | Critical | Medium | ✅ Complete |
| **PDF Export** | Generate professional PDF with layout diagram, structural specs, and BOM | Critical | Medium | ✅ Complete |
| **Shopify Integration** | Connect to live TUDS inventory, real-time pricing, "Add to Cart" | Critical | High | Planned |
| **Customer Info Capture** | Attach customer name, address, phone, email to projects | High | Low | ✅ Complete |
| **Quote Sharing** | Generate shareable link or email quote to customer | High | Medium | Planned |

### Tier 2: Design Enhancement (Competitive Advantage)
*Features that make the design experience better than competitors.*

| Feature | Description | Impact | Effort | Status |
|---------|-------------|--------|--------|--------|
| **Decking Tab Implementation** | Material selection, board direction, color preview | High | High | Planned |
| **Photo Overlay Mode** | Upload backyard photo, trace deck outline over it | High | Medium | Planned |
| **3D Viewer (Read-Only)** | View completed design in 3D (not full editor) | High | High | Planned |
| **Component Library** | Add pergolas, benches, privacy screens, planters | Medium | Medium | Planned |
| **Multi-Level Decks** | Support for split-level and bi-level deck designs | Medium | High | Planned |

### Tier 3: Professional Tools (Contractor Focus)
*Features for professional contractors and complex projects.*

| Feature | Description | Impact | Effort | Status |
|---------|-------------|--------|--------|--------|
| **Code Compliance Checker** | Ontario Building Code validation with warnings/errors | High | High | Planned |
| **Permit Document Generator** | Auto-generate permit application documents | High | Medium | Planned |
| **Measurement Tool** | Point-to-point distance measurement on canvas | Medium | Low | ✅ Complete |
| **Railing Tab Implementation** | Railing style selection, post spacing, materials | Medium | High | Planned |
| **Annotation Mode** | Add notes and callouts to designs | Low | Low | Planned |

### Tier 4: Platform & Mobile (Scale & Accessibility)
*Features for broader reach and on-site usage.*

| Feature | Description | Impact | Effort | Status |
|---------|-------------|--------|--------|--------|
| **Mobile/Tablet Optimization** | Responsive design for iPad on-site sales | High | Medium | Planned |
| **User Accounts** | Login, save multiple projects, order history | Medium | High | Planned |
| **Collaborative Sharing** | Multiple stakeholders view/comment on design | Medium | High | Planned |
| **Offline Mode** | Work without internet, sync when connected | Low | High | Planned |

### Tier 5: Future Innovation (Long-Term Vision)
*Advanced features for market leadership.*

| Feature | Description | Impact | Effort | Status |
|---------|-------------|--------|--------|--------|
| **AR "Place My Deck"** | Visualize deck in real backyard via mobile camera | High | Very High | Future |
| **AI Design Suggestions** | Generate initial layouts based on lot dimensions | Medium | Very High | Future |
| **Contractor Marketplace** | Connect customers with local installers | Medium | Very High | Future |
| **VR Walkthrough** | Virtual reality deck experience | Low | Very High | Future |

---

## Implementation Notes

### Tier 1 Dependencies
- **Save/Load** should use localStorage initially, cloud storage later
- **PDF Export** can use jsPDF or html2canvas libraries
- **Shopify Integration** requires Shopify Storefront API access
- **Quote Sharing** needs unique URL generation + backend storage

### Technical Considerations
- Current architecture is client-side only (no backend)
- Adding backend would enable: user accounts, cloud storage, sharing
- Shopify integration can be done client-side with Storefront API

### Design System
- All new features should follow established visual selector pattern
- Maintain TUDS brand colors and typography
- Keep mobile-first responsive approach

---

## Completed Features (Reference)

| Feature | Completion Date |
|---------|-----------------|
| Interactive Drawing Canvas | Complete |
| Complex Shape Support (L, U, T shapes) | November 2025 |
| Multi-Wall Ledger Selection | November 2025 |
| Diagonal/Bay Window Support | November 2025 |
| Structural Calculations | Complete |
| BOM Generation | Complete |
| Stair System | Complete |
| Blueprint Mode | Complete |
| Print Optimization | Complete |
| Visual Selector UI Consistency | November 2025 |
| Save/Load Projects | November 2025 |
| PDF Export | November 2025 |
| Customer Info Capture | November 2025 |
| Measurement Tool | December 2025 |

---

## Success Metrics

### Sales Impact
- Time to generate quote: Target < 5 minutes
- Quote accuracy: Target 95%+ match to final invoice
- Customer conversion: Track quotes vs purchases

### User Experience
- Mobile usability score: Target 90+
- Feature adoption rate: Track which features are used
- Customer feedback: NPS score tracking

---

## Review Schedule
- Monthly: Review Tier 1-2 progress
- Quarterly: Reassess priorities based on sales feedback
- Annually: Major roadmap revision
