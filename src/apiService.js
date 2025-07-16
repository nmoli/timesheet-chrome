const API_BASE_URL = process.env.API_URL;
const AUTH_HEADER = process.env.REACT_APP_TIMESHEET_AUTH_TOKEN;

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.authHeader = AUTH_HEADER;
  }

  // Helper method to make authenticated API calls
  async makeRequest(endpoint, options = {}) {
    let url = `${this.baseUrl}${endpoint}`;

    // Add auth as query parameter as fallback
    const separator = endpoint.includes("?") ? "&" : "?";
    url += `${separator}auth=${this.authHeader}`;

    const config = {
      headers: {
        "Content-Type": "application/json",
        "timesheet-auth": this.authHeader,
        "x-timesheet-auth": this.authHeader, // Alternative header name
        ...options.headers,
      },
      ...options,
    };

    console.log("Making API request to:", url);
    console.log("Request headers:", config.headers);

    try {
      const response = await fetch(url, config);

      console.log("Response status:", response.status);
      console.log("Response status text:", response.statusText);
      console.log(
        "Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      // Log the raw response text first
      const responseText = await response.text();
      console.log("Raw response text:", responseText);

      if (!response.ok) {
        console.error("HTTP error - status:", response.status);
        console.error("Response text:", responseText);

        let errorData = {};
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { message: responseText };
        }

        throw new Error(
          errorData.message ||
            errorData.error ||
            `HTTP error! status: ${response.status}`
        );
      }

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse JSON:", e);
        throw new Error("Invalid JSON response from server");
      }

      console.log("Success response:", data);
      return data;
    } catch (error) {
      console.error("API request failed:", error);
      console.error("Request URL:", url);
      console.error("Request config:", config);
      throw error;
    }
  }

  // Labels API
  async getLabels() {
    return this.makeRequest("/api/labels");
  }

  async createLabel(name) {
    return this.makeRequest("/api/labels", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async deleteLabel(name) {
    return this.makeRequest(`/api/labels/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  }

  // Sessions API
  async getSessions() {
    return this.makeRequest("/api/sessions");
  }

  async createSession(sessionData) {
    return this.makeRequest("/api/sessions", {
      method: "POST",
      body: JSON.stringify(sessionData),
    });
  }

  async updateSession(id, updateData) {
    return this.makeRequest(`/api/sessions/${id}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
  }

  async deleteSession(id) {
    return this.makeRequest(`/api/sessions/${id}`, {
      method: "DELETE",
    });
  }

  // Health check (no auth required)
  async healthCheck() {
    const url = `${this.baseUrl}/health`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Health check failed:", error);
      throw error;
    }
  }
}

export default new ApiService();
