using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LongBets.Migrations
{
    /// <inheritdoc />
    public partial class ResolutionNotesAndWinNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OwnerKey",
                table: "Stakes",
                type: "TEXT",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WinNote",
                table: "Stakes",
                type: "TEXT",
                maxLength: 600,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResolutionNote",
                table: "Bets",
                type: "TEXT",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OwnerKey",
                table: "Stakes");

            migrationBuilder.DropColumn(
                name: "WinNote",
                table: "Stakes");

            migrationBuilder.DropColumn(
                name: "ResolutionNote",
                table: "Bets");
        }
    }
}
