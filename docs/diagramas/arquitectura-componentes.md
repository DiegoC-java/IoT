```mermaid
    graph TD;
        A[Client] --> B[API Gateway];
        B --> C[Authentication Service];
        B --> D[IoT Device Management];
        C --> E[User Database];
        D --> F[Device Database];
    ```
    
    ## Component Diagram
    ```mermaid
    graph TD;
        subgraph Web Application
            A[Client] 
        end
        subgraph Backend
            B[API Gateway]
            C[Authentication Service]
            D[IoT Device Management]
        end
        A --> B;
        B --> C;
        B --> D;
    ```
    
    ## Sequence Diagram
    ```mermaid
    sequenceDiagram;
        Client->>API Gateway: Request
        API Gateway->>Authentication Service: Authenticate
        Authentication Service-->>API Gateway: Response
        API Gateway-->>Client: Response
    ```

    ## Deployment Diagram
    ```mermaid
    graph TD;
        A[User] --> B[Web Application];
        B --> C[Load Balancer];
        C --> D[API Servers];
        C --> E[Database];
    ```