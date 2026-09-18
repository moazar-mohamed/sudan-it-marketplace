/// A pending (or claimed) technician invitation created by a company admin.
/// Stored at `technicianInvites/{normalizedEmail}` so a technician's own
/// registration can look one up by their authenticated email.
class TechnicianInvite {
  const TechnicianInvite({
    required this.email,
    required this.fullName,
    required this.phone,
    required this.companyId,
    required this.status,
  });

  final String email;
  final String fullName;
  final String phone;
  final String companyId;
  final String status;

  bool get isPending => status == 'pending';
}
